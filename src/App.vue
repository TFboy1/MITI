<script setup>
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { toPng } from 'html-to-image'
import * as THREE from 'three'
import characters from './data/characters.json'
import questions from './data/questions.json'
import { sampleCombinedState } from './utils/particleSampler.js'

// Import slideshow JPGs from frontend_imgs
import imgVenti from './assets/frontend_imgs/温迪.jpg'
import imgZhongli from './assets/frontend_imgs/钟离.jpg'
import imgRaiden from './assets/frontend_imgs/雷电将军.jpg'
import imgNahida from './assets/frontend_imgs/纳西妲.jpg'
import imgFurina from './assets/frontend_imgs/芙宁娜.jpg'
import imgKlee from './assets/frontend_imgs/可莉.jpg'

const characterImages = import.meta.glob('./assets/characters/*.{png,jpg,jpeg,webp,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
})

const imageMap = Object.fromEntries(
  Object.entries(characterImages).map(([path, url]) => [decodeURIComponent(path.split('/').pop()), url])
)

const dimensions = [
  { key: 'bond', label: '羁绊', description: '关系、守护、归属、共情' },
  { key: 'order', label: '秩序', description: '职责、契约、原则、掌控' },
  { key: 'freedom', label: '自由', description: '旅行、玩心、即兴、反叛' },
  { key: 'insight', label: '洞察', description: '知识、推理、审美、策略' },
  { key: 'intensity', label: '锋芒', description: '风险、战斗、野心、爆发' },
  { key: 'persona', label: '幻面', description: '身份、舞台、伪装、叙事' }
]

const gameLabels = {
  starrail: '崩坏：星穹铁道',
  genshin: '原神',
  zzz: '绝区零'
}

const dimensionWeights = Object.fromEntries(dimensions.map(({ key }) => [key, 1]))
const radarCenter = 130
const radarRadius = 86
const radarGridLevels = [0.25, 0.5, 0.75, 1]

// 3D Particles Settings
const PARTICLE_COUNT = 15000;
const isLoading = ref(true);
const currentActiveSlide = ref(0);
const scrollContainerRef = ref(null);

const slides = [
  {
    index: 0,
    name: '温迪',
    theme: '#48b89a',
    image: imgVenti,
    text: 'MITI\n三游人格测试',
    subtitle: 'Mihoyo Inspired Type Indicator'
  },
  {
    index: 1,
    name: '钟离',
    theme: '#b98a3b',
    image: imgZhongli,
    text: '六大核心维度\n深度分析性格',
    subtitle: '专业分析维度'
  },
  {
    index: 2,
    name: '雷电将军',
    theme: '#8b63c7',
    image: imgRaiden,
    text: '跨越三大宇宙\n寻找心灵共振',
    subtitle: '原神・星铁・绝区零'
  },
  {
    index: 3,
    name: '纳西妲',
    theme: '#7fbd66',
    image: imgNahida,
    text: '欧氏距离算法\n科学寻找投影',
    subtitle: '契合匹配机制'
  },
  {
    index: 4,
    name: '芙宁娜',
    theme: '#4f9edc',
    image: imgFurina,
    text: '精美结果报告\n雷达图与海报',
    subtitle: '结果分析与导出'
  },
  {
    index: 5,
    name: '可莉',
    theme: '#e85a4f',
    image: imgKlee,
    text: '开启你的测试\n共鸣就此开始',
    subtitle: '立即出发',
    isFinal: true
  }
]

const activeSlideThemeStyle = computed(() => {
  const slide = slides[currentActiveSlide.value]
  if (!slide) return {}
  return {
    '--accent': slide.theme,
    '--accent-soft': `${slide.theme}24`
  }
})

// Core test states
const view = ref('home')
const currentIndex = ref(0)
const answers = ref({})
const currentAnswerValue = ref(0)
const imageErrors = ref({})
const posterRef = ref(null)
const isExporting = ref(false)
const exportError = ref('')

const currentQuestion = computed(() => questions[currentIndex.value])
const answerOptions = [-3, -2, -1, 0, 1, 2, 3]
const answeredCount = computed(() => Object.keys(answers.value).length)
const progress = computed(() => Math.round((answeredCount.value / questions.length) * 100))
const isComplete = computed(() => answeredCount.value === questions.length)

const groupedCharacters = computed(() => {
  return Object.entries(gameLabels).map(([game, label]) => ({
    game,
    label,
    characters: characters.filter((character) => character.game === game)
  }))
})

const scoreRanges = computed(() => {
  const ranges = Object.fromEntries(dimensions.map(({ key }) => [key, { min: 0, max: 0 }]))

  questions.forEach((question) => {
    dimensions.forEach(({ key }) => {
      const left = question.leftScores?.[key] ?? 0
      const right = question.rightScores?.[key] ?? 0
      ranges[key].min += Math.min(left, right, 0)
      ranges[key].max += Math.max(left, right, 0)
    })
  })

  return ranges
})

const rawScores = computed(() => {
  const scores = Object.fromEntries(dimensions.map(({ key }) => [key, 0]))

  Object.entries(answers.value).forEach(([questionId, value]) => {
    const question = questions.find((item) => item.id === questionId)
    if (!question) return

    if (value < 0) {
      const weight = Math.abs(value) / 3
      Object.entries(question.leftScores).forEach(([key, score]) => {
        if (key in scores) scores[key] += score * weight
      })
    } else if (value > 0) {
      const weight = value / 3
      Object.entries(question.rightScores).forEach(([key, score]) => {
        if (key in scores) scores[key] += score * weight
      })
    }
  })

  return scores
})

const normalizedScores = computed(() => {
  return Object.fromEntries(
    dimensions.map(({ key }) => {
      const range = scoreRanges.value[key]
      if (!range || range.max === range.min) return [key, 0.5]

      const normalized = (rawScores.value[key] - range.min) / (range.max - range.min)
      const clamped = Math.min(1, Math.max(0, normalized))
      return [key, Number(clamped.toFixed(3))]
    })
  )
})

const rankedCharacters = computed(() => {
  return characters
    .map((character) => {
      const distance = Math.sqrt(
        dimensions.reduce((sum, { key }) => {
          const diff = normalizedScores.value[key] - character.profile[key]
          return sum + dimensionWeights[key] * diff * diff
        }, 0)
      )
      const maxDistance = Math.sqrt(dimensions.reduce((sum, { key }) => sum + dimensionWeights[key], 0))
      const match = Math.max(0, Math.round((1 - distance / maxDistance) * 100))
      return { ...character, distance, match }
    })
    .sort((a, b) => a.distance - b.distance)
})

const result = computed(() => rankedCharacters.value[0] ?? characters[0])

const resultThemeStyle = computed(() => ({
  '--accent': result.value.theme,
  '--accent-soft': `${result.value.theme}24`
}))

const radarPolygonPoints = computed(() => getRadarPoints(normalizedScores.value, radarRadius))
const radarValuePoints = computed(() => getRadarPointData(normalizedScores.value, radarRadius))
const radarGridPolygons = computed(() => radarGridLevels.map((level) => getRadarPoints(null, radarRadius * level)))

const radarAxisData = computed(() => {
  return dimensions.map((dimension, index) => {
    const angle = getRadarAngle(index)
    const axis = getPoint(angle, radarRadius)
    const label = getPoint(angle, radarRadius + 24)
    return {
      ...dimension,
      axis: `${radarCenter},${radarCenter} ${axis.x},${axis.y}`,
      labelX: label.x,
      labelY: label.y,
      percent: getDimensionPercent(dimension.key)
    }
  })
})

function getRadarAngle(index) {
  return (Math.PI * 2 * index) / dimensions.length - Math.PI / 2
}

function getPoint(angle, radius) {
  return {
    x: Number((radarCenter + Math.cos(angle) * radius).toFixed(2)),
    y: Number((radarCenter + Math.sin(angle) * radius).toFixed(2))
  }
}

function getRadarPointData(scores, radius) {
  return dimensions.map(({ key }, index) => {
    const value = scores?.[key] ?? 1
    return getPoint(getRadarAngle(index), radius * value)
  })
}

function getRadarPoints(scores, radius) {
  return getRadarPointData(scores, radius)
    .map((point) => `${point.x},${point.y}`)
    .join(' ')
}

function startTest() {
  view.value = 'test'
  currentIndex.value = 0
  currentAnswerValue.value = 0
}

function resetTest() {
  answers.value = {}
  currentIndex.value = 0
  currentAnswerValue.value = 0
  view.value = 'home'
  
  // Wait for the slide container to mount before resetting scroll position
  nextTick(() => {
    scrollToSlide(0)
  })
}

function submitAnswer(answerValue = currentAnswerValue.value) {
  answers.value = { ...answers.value, [currentQuestion.value.id]: answerValue }
  if (currentIndex.value < questions.length - 1) {
    currentIndex.value += 1
    currentAnswerValue.value = answers.value[questions[currentIndex.value].id] ?? 0
  } else {
    view.value = 'result'
  }
}

function selectAnswer(option) {
  currentAnswerValue.value = option
  submitAnswer(option)
}

function previousQuestion() {
  if (currentIndex.value > 0) {
    currentIndex.value -= 1
    currentAnswerValue.value = answers.value[currentQuestion.value.id] ?? 0
  }
}

function showResultIfReady() {
  if (isComplete.value) {
    view.value = 'result'
  }
}

function markImageError(id) {
  imageErrors.value = { ...imageErrors.value, [id]: true }
}

function getImageSrc(character) {
  const filename = character.image?.split('/').pop() || `${character.name}.png`
  return imageMap[filename] ?? imageMap[`${character.name}.png`] ?? ''
}

function shouldShowImage(character) {
  return Boolean(getImageSrc(character)) && !imageErrors.value[character.id]
}

function getDimensionPercent(key) {
  return Math.round((normalizedScores.value[key] ?? 0) * 100)
}

function getGameLabel(game) {
  return gameLabels[game] ?? game
}

// Fullscreen slideshow navigation
const scrollToSlide = (index) => {
  if (!scrollContainerRef.value) return
  const height = scrollContainerRef.value.clientHeight
  scrollContainerRef.value.scrollTo({
    top: index * height,
    behavior: 'smooth'
  })
}

const onScroll = (e) => {
  const scrollTop = e.target.scrollTop
  const height = e.target.clientHeight
  if (height === 0) return
  const index = Math.round(scrollTop / height)
  if (index !== currentActiveSlide.value && index >= 0 && index < slides.length) {
    triggerTransition(index)
  }
}

// Three.js 3D Particles Implementation
let scene, camera, renderer, geometry, material, pointsMesh
let transitionAnimationFrameId = null
let renderLoopId = null
const preloadedStates = []

let mouseX = 0
let mouseY = 0
const onMouseMove = (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2
}

const onResize = () => {
  if (!camera || !renderer) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

const triggerTransition = (newIndex) => {
  if (newIndex === currentActiveSlide.value || preloadedStates.length === 0) return
  
  // Calculate current interpolated coordinates if mid-transition
  const currentTransition = material.uniforms.uTransition.value
  if (currentTransition > 0 && currentTransition < 1) {
    const posAttr = geometry.attributes.position
    const targetPosAttr = geometry.attributes.aTargetPosition
    const colAttr = geometry.attributes.aSourceColor
    const targetColAttr = geometry.attributes.aTargetColor
    
    const tempPositions = new Float32Array(PARTICLE_COUNT * 3)
    const tempColors = new Float32Array(PARTICLE_COUNT * 3)
    
    const t = currentTransition
    const easedT = t * t * (3.0 - 2.0 * t) // smoothstep
    
    for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
      tempPositions[i] = posAttr.array[i] * (1 - easedT) + targetPosAttr.array[i] * easedT
      tempColors[i] = colAttr.array[i] * (1 - easedT) + targetColAttr.array[i] * easedT
    }
    
    posAttr.copyArray(tempPositions)
    colAttr.copyArray(tempColors)
  } else {
    // Start morph from clean copy of last state
    const lastState = preloadedStates[currentActiveSlide.value]
    if (lastState) {
      geometry.attributes.position.copyArray(lastState.positions)
      geometry.attributes.aSourceColor.copyArray(lastState.colors)
    }
  }
  
  // Load target state data
  const targetState = preloadedStates[newIndex]
  if (!targetState) return
  geometry.attributes.aTargetPosition.copyArray(targetState.positions)
  geometry.attributes.aTargetColor.copyArray(targetState.colors)
  
  geometry.attributes.position.needsUpdate = true
  geometry.attributes.aSourceColor.needsUpdate = true
  geometry.attributes.aTargetPosition.needsUpdate = true
  geometry.attributes.aTargetColor.needsUpdate = true
  
  material.uniforms.uTransition.value = 0.0
  currentActiveSlide.value = newIndex
  
  // Animate uTransition progress from 0.0 to 1.0
  if (transitionAnimationFrameId) cancelAnimationFrame(transitionAnimationFrameId)
  
  const duration = 1400 // Smooth cinematic transition time
  const startTime = performance.now()
  
  const animateTransition = (time) => {
    const elapsed = time - startTime
    const progress = Math.min(elapsed / duration, 1.0)
    
    material.uniforms.uTransition.value = progress
    
    if (progress < 1.0) {
      transitionAnimationFrameId = requestAnimationFrame(animateTransition)
    } else {
      // Done, finalize source data to target data to prevent drifts
      geometry.attributes.position.copyArray(targetState.positions)
      geometry.attributes.aSourceColor.copyArray(targetState.colors)
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.aSourceColor.needsUpdate = true
      material.uniforms.uTransition.value = 0.0
    }
  }
  transitionAnimationFrameId = requestAnimationFrame(animateTransition)
}

const initWebGL = async () => {
  try {
    // 1. Asynchronously load all 3D particle positions/colors
    for (const slide of slides) {
      const state = await sampleCombinedState(slide.image, slide.text, PARTICLE_COUNT, slide.theme, 8000)
      preloadedStates.push(state)
    }
    
    isLoading.value = false
    await nextTick()
    
    const canvas = document.getElementById('webgl-canvas')
    if (!canvas) return
    
    scene = new THREE.Scene()
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000)
    camera.position.z = 150
    
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    
    // Geometry with state 0
    const initialState = preloadedStates[0]
    geometry = new THREE.BufferGeometry()
    
    const posArray = new Float32Array(initialState.positions)
    const colArray = new Float32Array(initialState.colors)
    const targetPosArray = new Float32Array(initialState.positions)
    const targetColArray = new Float32Array(initialState.colors)
    
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
    geometry.setAttribute('aSourceColor', new THREE.BufferAttribute(colArray, 3))
    geometry.setAttribute('aTargetPosition', new THREE.BufferAttribute(targetPosArray, 3))
    geometry.setAttribute('aTargetColor', new THREE.BufferAttribute(targetColArray, 3))
    
    // WebGL Material using highly optimized and aesthetically pleasing Vertex Shaders
    material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTransition: { value: 0.0 },
        uTime: { value: 0.0 }
      },
      vertexShader: `
        uniform float uTransition;
        uniform float uTime;
        attribute vec3 aSourceColor;
        attribute vec3 aTargetPosition;
        attribute vec3 aTargetColor;
        varying vec3 vColor;
        
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }
        
        void main() {
            // Cubic smooth transition
            float t = uTransition * uTransition * (3.0 - 2.0 * uTransition);
            
            vec3 currentPos = mix(position, aTargetPosition, t);
            
            // Subtly wave the heightmap surface for floating animation
            float wave = sin(currentPos.x * 0.045 + uTime * 1.6) * cos(currentPos.y * 0.045 + uTime * 1.3);
            currentPos.z += wave * 3.5;
            
            // Particle cloud turbulence explosion in the middle of transition
            float transitionFactor = sin(t * 3.14159265);
            float r1 = random(currentPos.xy);
            float r2 = random(currentPos.yz);
            float r3 = random(currentPos.xz);
            vec3 noiseVec = vec3(r1 - 0.5, r2 - 0.5, r3 - 0.5) * 20.0 * transitionFactor;
            currentPos += noiseVec;
            
            vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            // Size based on depth plus breathing animation
            float sizeBreathing = 1.0 + 0.15 * sin(uTime * 2.0 + position.x * 0.15);
            gl_PointSize = (450.0 / -mvPosition.z) * sizeBreathing;
            
            vColor = mix(aSourceColor, aTargetColor, t);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            if (dist > 0.5) {
                discard;
            }
            float alpha = smoothstep(0.5, 0.35, dist);
            gl_FragColor = vec4(vColor, alpha * 0.85);
        }
      `
    })
    
    pointsMesh = new THREE.Points(geometry, material)
    scene.add(pointsMesh)
    
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('resize', onResize)
    
    const clock = new THREE.Clock()
    const tick = () => {
      if (view.value === 'home' && renderer && scene && camera) {
        const time = clock.getElapsedTime()
        material.uniforms.uTime.value = time
        
        // Follow mouse movement smoothly for parallax tilt
        const targetRotY = Math.sin(time * 0.12) * 0.12 + mouseX * 0.22
        const targetRotX = Math.cos(time * 0.08) * 0.06 + mouseY * 0.12
        
        pointsMesh.rotation.y += (targetRotY - pointsMesh.rotation.y) * 0.05
        pointsMesh.rotation.x += (targetRotX - pointsMesh.rotation.x) * 0.05
        
        renderer.render(scene, camera)
      }
      renderLoopId = requestAnimationFrame(tick)
    }
    tick()
  } catch (error) {
    console.error('Failed to load WebGL scene:', error)
    isLoading.value = false
  }
}

onMounted(() => {
  initWebGL()
})

onUnmounted(() => {
  if (transitionAnimationFrameId) cancelAnimationFrame(transitionAnimationFrameId)
  if (renderLoopId) cancelAnimationFrame(renderLoopId)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('resize', onResize)
  
  if (geometry) geometry.dispose()
  if (material) material.dispose()
  if (renderer) renderer.dispose()
})

// Control WebGL canvas visibility when entering test states
watch(view, (newView) => {
  const canvas = document.getElementById('webgl-canvas')
  if (!canvas) return
  if (newView === 'home') {
    canvas.style.display = 'block'
  } else {
    canvas.style.display = 'none'
  }
})

async function exportPoster() {
  if (!posterRef.value || isExporting.value) return
  isExporting.value = true
  exportError.value = ''

  try {
    await nextTick()
    const dataUrl = await toPng(posterRef.value, {
      cacheBust: true,
      pixelRatio: 2,
      width: 720,
      height: 1080,
      canvasWidth: 1440,
      canvasHeight: 2160,
      backgroundColor: '#f8f1e6',
      style: {
        position: 'static',
        left: '0',
        top: '0',
        transform: 'none',
        width: '720px',
        height: '1080px',
        minHeight: '1080px',
        opacity: '1'
      }
    })
    const link = document.createElement('a')
    link.download = `MITI-${result.value.name}.png`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    console.error(error)
    exportError.value = '导出失败，请稍后重试，或检查浏览器是否拦截了下载。'
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <!-- HOME VIEW (WebGL 3D Slideshow) -->
  <div v-if="view === 'home'" class="home-slides-wrapper" :style="activeSlideThemeStyle">
    <!-- WebGL Canvas Background -->
    <canvas id="webgl-canvas"></canvas>

    <!-- Loading Screen -->
    <div v-if="isLoading" class="loader-overlay">
      <div class="loader-spinner"></div>
      <p>正在加载 3D 粒子系统...</p>
    </div>

    <!-- Fixed Header Overlay -->
    <header class="fixed-topbar">
      <button class="brand" type="button" @click="scrollToSlide(0)">
        <span class="brand-mark">M</span>
        <span>MITI</span>
      </button>
      <div class="nav-meta">
        <span>三游人格测试</span>
        <span>{{ characters.length }} 位角色</span>
        <span>{{ questions.length }} 道题</span>
      </div>
    </header>

    <!-- Slides Container -->
    <div ref="scrollContainerRef" class="slides-container" @scroll="onScroll">
      <section
        v-for="(slide, idx) in slides"
        :key="idx"
        class="slide-section"
        :class="{ active: currentActiveSlide === idx }"
      >
        <div class="slide-content">
          <!-- CTA buttons on final slide -->
          <div v-if="slide.isFinal" class="slide-actions">
            <button class="primary-button" type="button" @click="startTest">开始测试</button>
            <button v-if="isComplete" class="ghost-button" type="button" @click="showResultIfReady">查看上次结果</button>
          </div>
        </div>

        <!-- Scroll indicator down arrow -->
        <div v-if="idx < slides.length - 1" class="scroll-hint" @click="scrollToSlide(idx + 1)">
          <span>继续滑动</span>
        </div>
      </section>
    </div>

    <!-- Right Side Pagination Dots -->
    <nav class="slide-nav">
      <button
        v-for="(_, idx) in slides"
        :key="idx"
        class="slide-nav-dot"
        :class="{ active: currentActiveSlide === idx }"
        :aria-label="'Go to slide ' + (idx + 1)"
        type="button"
        @click="scrollToSlide(idx)"
      ></button>
    </nav>
  </div>

  <!-- TEST & RESULT VIEWS -->
  <main v-else class="app-shell" :class="[view === 'test' ? 'test-mode' : '', view === 'result' ? 'result-mode' : '']">
    <header class="topbar">
      <button class="brand" type="button" @click="resetTest">
        <span class="brand-mark">M</span>
        <span>MITI</span>
      </button>
      <div class="nav-meta">
        <span>三游人格测试</span>
        <span>{{ characters.length }} 位角色</span>
        <span>{{ questions.length }} 道题</span>
      </div>
    </header>

    <!-- Answer Test Stage -->
    <section v-if="view === 'test'" class="test-stage">
      <div class="progress-wrap" aria-label="答题进度">
        <div class="progress-label">
          <span>第 {{ currentIndex + 1 }} 题 / {{ questions.length }}</span>
          <strong>{{ progress }}%</strong>
        </div>
        <div class="progress-track">
          <span :style="{ width: `${progress}%` }"></span>
        </div>
      </div>

      <article class="question-card">
        <p class="question-kicker">选择更像你的那一边</p>
        <h2>{{ currentQuestion.text }}</h2>

        <div class="answer-picker-wrap">
          <div class="choice-labels">
            <span class="left-label">{{ currentQuestion.leftLabel }}</span>
            <span class="right-label">{{ currentQuestion.rightLabel }}</span>
          </div>

          <div class="answer-options" aria-label="选择倾向度">
            <button
              v-for="option in answerOptions"
              :key="option"
              class="answer-option"
              :class="{
                selected: currentAnswerValue === option,
                negative: option < 0,
                positive: option > 0,
                neutral: option === 0,
                [`level-${Math.abs(option)}`]: true
              }"
              type="button"
              @click="selectAnswer(option)"
            >
              {{ option > 0 ? `+${option}` : option }}
            </button>
          </div>

          <div class="current-value">
            已选择：{{ currentAnswerValue < 0 ? currentQuestion.leftLabel : currentAnswerValue > 0 ? currentQuestion.rightLabel : '中立' }}
            <span>{{ currentAnswerValue > 0 ? '+' : '' }}{{ currentAnswerValue }}</span>
          </div>
        </div>
      </article>

      <div class="test-actions">
        <button class="primary-button next-button" type="button" @click="submitAnswer">
          {{ currentIndex < questions.length - 1 ? '下一题' : '查看结果' }}
        </button>
        <button class="ghost-button" type="button" :disabled="currentIndex === 0" @click="previousQuestion">上一题</button>
        <button class="ghost-button" type="button" @click="resetTest">退出</button>
      </div>
    </section>

    <!-- Test Result Stage -->
    <section v-else class="result-stage" :style="resultThemeStyle">
      <article class="result-card">
        <div class="result-portrait">
          <img
            v-if="shouldShowImage(result)"
            :src="getImageSrc(result)"
            :alt="result.name"
            @error="markImageError(result.id)"
          />
          <div v-else class="portrait-placeholder">
            <span>{{ result.name }}</span>
          </div>
        </div>

        <div class="result-copy">
          <p class="eyebrow">你的 MITI 结果 · {{ result.match }}% 匹配</p>
          <p class="result-game">{{ getGameLabel(result.game) }}</p>
          <h2>{{ result.name }} · {{ result.title }}</h2>
          <p class="result-archetype">{{ result.archetype }}</p>
          <p class="result-core">{{ result.core }}</p>
          <p class="result-direction">视觉关键词：{{ result.direction }}</p>

          <div class="dimension-radar">
            <svg class="radar-svg" viewBox="0 0 260 260" role="img" aria-label="六维人格结果图">
              <polygon
                v-for="points in radarGridPolygons"
                :key="points"
                class="radar-grid"
                :points="points"
              />
              <polyline
                v-for="axis in radarAxisData"
                :key="axis.key"
                class="radar-axis"
                :points="axis.axis"
              />
              <polygon class="radar-shape" :points="radarPolygonPoints" />
              <circle
                v-for="(point, index) in radarValuePoints"
                :key="`${dimensions[index].key}-dot`"
                class="radar-dot"
                :cx="point.x"
                :cy="point.y"
                r="3"
              />
              <text
                v-for="axis in radarAxisData"
                :key="`${axis.key}-label`"
                class="radar-label"
                :x="axis.labelX"
                :y="axis.labelY"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                {{ axis.label }}
              </text>
            </svg>
            <div class="radar-legend">
              <div v-for="dimension in radarAxisData" :key="dimension.key" class="radar-legend-item">
                <strong>{{ dimension.label }}</strong>
                <span>{{ dimension.description }}</span>
                <em>{{ dimension.percent }}%</em>
              </div>
            </div>
          </div>

          <div class="result-actions">
            <button class="primary-button" type="button" @click="exportPoster">
              {{ isExporting ? '导出中...' : '导出结果海报' }}
            </button>
            <button class="ghost-button" type="button" @click="resetTest">重新测试</button>
          </div>
          <p v-if="exportError" class="export-error">{{ exportError }}</p>
        </div>
      </article>

      <section class="report-section">
        <article class="report-block report-overview">
          <p class="section-label">人格概览</p>
          <h3>你为什么会匹配到 {{ result.name }}</h3>
          <p>{{ result.report.overview }}</p>
        </article>

        <div class="report-grid">
          <article class="report-block">
            <p class="section-label">相似之处</p>
            <h3>你和 {{ result.title }} 的共振点</h3>
            <ul>
              <li v-for="item in result.report.similarities" :key="item">{{ item }}</li>
            </ul>
          </article>

          <article class="report-block">
            <p class="section-label">优势</p>
            <h3>你擅长的能量形态</h3>
            <ul>
              <li v-for="item in result.report.strengths" :key="item">{{ item }}</li>
            </ul>
          </article>

          <article class="report-block">
            <p class="section-label">盲点</p>
            <h3>容易被忽略的代价</h3>
            <ul>
              <li v-for="item in result.report.blindspots" :key="item">{{ item }}</li>
            </ul>
          </article>

          <article class="report-block advice-block">
            <p class="section-label">建议</p>
            <h3>给这个结果的一句话</h3>
            <p>{{ result.report.advice }}</p>
          </article>
        </div>
      </section>

      <aside class="runner-up">
        <p>相近结果</p>
        <span v-for="character in rankedCharacters.slice(1, 5)" :key="character.id">
          {{ character.name }} · {{ getGameLabel(character.game) }} {{ character.match }}%
        </span>
      </aside>

      <!-- Hide Poster from standard flow, only for PNG conversion -->
      <article ref="posterRef" class="poster" :style="resultThemeStyle" aria-hidden="true">
        <div class="poster-top">
          <span>MITI</span>
          <strong>{{ result.match }}% 匹配</strong>
        </div>
        <div class="poster-art">
          <img
            v-if="shouldShowImage(result)"
            :src="getImageSrc(result)"
            :alt="result.name"
            @error="markImageError(result.id)"
          />
          <div v-else class="portrait-placeholder">
            <span>{{ result.name }}</span>
          </div>
        </div>
        <p class="poster-game">{{ getGameLabel(result.game) }}</p>
        <p class="poster-name">{{ result.name }}</p>
        <h3>{{ result.title }}</h3>
        <p class="poster-archetype">{{ result.archetype }}</p>
        <p class="poster-core">{{ result.core }}</p>
        <p class="poster-summary">{{ result.report.similarities[0] }}</p>
        <div class="poster-bars">
          <div v-for="dimension in dimensions" :key="dimension.key">
            <span>{{ dimension.label }}</span>
            <i><b :style="{ width: `${getDimensionPercent(dimension.key)}%` }"></b></i>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>
