<script setup>
import { computed, nextTick, ref } from 'vue'
import { toPng } from 'html-to-image'
import characters from './data/characters.json'
import questions from './data/questions.json'

const characterImages = import.meta.glob('./assets/characters/*.{png,jpg,jpeg,webp,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
})

const dimensions = [
  { key: 'memory', label: '记录', description: '过去、记忆、证据' },
  { key: 'control', label: '掌控', description: '剧本、秩序、预判' },
  { key: 'risk', label: '冒险', description: '赌局、突破、变量' },
  { key: 'logic', label: '理性', description: '知识、推导、诊断' },
  { key: 'mask', label: '面具', description: '身份、表演、伪装' }
]

const view = ref('home')
const currentIndex = ref(0)
const answers = ref({})
const currentSliderValue = ref(0)
const imageErrors = ref({})
const posterRef = ref(null)
const isExporting = ref(false)
const exportError = ref('')

const currentQuestion = computed(() => questions[currentIndex.value])
const answeredCount = computed(() => Object.keys(answers.value).length)
const progress = computed(() => Math.round((answeredCount.value / questions.length) * 100))
const isComplete = computed(() => answeredCount.value === questions.length)

const theoreticalBounds = computed(() => {
  const maxScores = Object.fromEntries(dimensions.map(({ key }) => [key, 0]))
  const minScores = Object.fromEntries(dimensions.map(({ key }) => [key, 0]))

  questions.forEach((q) => {
    dimensions.forEach(({ key }) => {
      const leftVal = q.leftScores[key] || 0
      const rightVal = q.rightScores[key] || 0
      maxScores[key] += Math.max(leftVal, rightVal, 0)
      minScores[key] += Math.min(leftVal, rightVal, 0)
    })
  })

  return { maxScores, minScores }
})

const rawScores = computed(() => {
  const scores = Object.fromEntries(dimensions.map(({ key }) => [key, 0]))

  Object.entries(answers.value).forEach(([questionId, value]) => {
    const question = questions.find((item) => item.id === questionId)
    if (!question) return
    
    if (value < 0) {
      const weight = Math.abs(value) / 5
      Object.entries(question.leftScores).forEach(([key, score]) => {
        scores[key] += score * weight
      })
    } else if (value > 0) {
      const weight = value / 5
      Object.entries(question.rightScores).forEach(([key, score]) => {
        scores[key] += score * weight
      })
    }
  })

  return scores
})

const normalizedScores = computed(() => {
  const { maxScores, minScores } = theoreticalBounds.value

  return Object.fromEntries(
    dimensions.map(({ key }) => {
      const max = maxScores[key]
      const min = minScores[key]
      const val = rawScores.value[key]
      
      if (max === min) return [key, 0.5]
      
      const normalized = Math.max(0, Math.min(1, (val - min) / (max - min)))
      return [key, Number(normalized.toFixed(3))]
    })
  )
})

const rankedCharacters = computed(() => {
  return characters
    .map((character) => {
      const distance = Math.sqrt(
        dimensions.reduce((sum, { key }) => {
          const diff = normalizedScores.value[key] - character.profile[key]
          return sum + diff * diff
        }, 0)
      )
      const maxDistance = Math.sqrt(dimensions.length)
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

function startTest() {
  view.value = 'test'
  currentIndex.value = 0
  currentSliderValue.value = 0
}

function resetTest() {
  answers.value = {}
  currentIndex.value = 0
  currentSliderValue.value = 0
  view.value = 'home'
}

function submitAnswer() {
  answers.value = { ...answers.value, [currentQuestion.value.id]: currentSliderValue.value }
  if (currentIndex.value < questions.length - 1) {
    currentIndex.value += 1
    currentSliderValue.value = 0
  } else {
    view.value = 'result'
  }
}

function previousQuestion() {
  if (currentIndex.value > 0) {
    currentIndex.value -= 1
    currentSliderValue.value = answers.value[currentQuestion.value.id] ?? 0
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
  const filename = character.image.split('/').pop()
  const match = Object.entries(characterImages).find(([path]) => path.endsWith(`/${filename}`))
  return match?.[1] ?? ''
}

function shouldShowImage(character) {
  return Boolean(getImageSrc(character)) && !imageErrors.value[character.id]
}

function getDimensionPercent(key) {
  return Math.round((normalizedScores.value[key] ?? 0) * 100)
}

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
    link.download = `MITI-${result.value.id}.png`
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
  <main class="app-shell">
    <header class="topbar">
      <button class="brand" type="button" @click="view = 'home'">
        <span class="brand-mark">M</span>
        <span>MITI</span>
      </button>
      <div class="nav-meta">
        <span>纯前端测试</span>
        <span>{{ characters.length }} 位角色</span>
      </div>
    </header>

    <section v-if="view === 'home'" class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Mihoyo Inspired Type Indicator</p>
        <h1>测一测，你会落在哪张星际人格卡上。</h1>
        <p class="hero-text">
          回答一组偏好题，MITI 会根据记录、掌控、冒险、理性和面具五个维度，匹配最接近你的角色画像。
        </p>
        <div class="hero-actions">
          <button class="primary-button" type="button" @click="startTest">开始测试</button>
          <button v-if="isComplete" class="ghost-button" type="button" @click="showResultIfReady">查看上次结果</button>
        </div>
      </div>

      <div class="character-cloud" aria-label="角色预览">
        <article
          v-for="character in characters"
          :key="character.id"
          class="mini-card"
          :style="{ '--accent': character.theme }"
        >
          <div class="mini-portrait">
            <img
              v-if="shouldShowImage(character)"
              :src="getImageSrc(character)"
              :alt="character.name"
              @error="markImageError(character.id)"
            />
            <span v-else>{{ character.titleEn }}</span>
          </div>
          <strong>{{ character.name }}</strong>
          <small>{{ character.titleCn }}</small>
        </article>
      </div>
    </section>

    <section v-else-if="view === 'test'" class="test-stage">
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
        
        <div class="answer-slider-wrap">
          <div class="slider-labels">
            <span class="left-label">A. {{ currentQuestion.leftLabel }}</span>
            <span class="right-label">B. {{ currentQuestion.rightLabel }}</span>
          </div>
          
          <div class="slider-control">
            <span class="val-min">-5</span>
            <input 
              type="range" 
              min="-5" 
              max="5" 
              step="1" 
              v-model.number="currentSliderValue" 
              class="answer-slider"
            />
            <span class="val-max">5</span>
          </div>
          
          <div class="current-value">
            倾向度: {{ currentSliderValue > 0 ? '+' : '' }}{{ currentSliderValue }}
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
            <span>{{ result.titleEn }}</span>
          </div>
        </div>

        <div class="result-copy">
          <p class="eyebrow">你的 MITI 结果</p>
          <h2>{{ result.name }} · {{ result.titleCn }}</h2>
          <p class="result-en">{{ result.titleEn }}</p>
          <p class="result-core">{{ result.core }}</p>
          <p class="result-direction">{{ result.direction }}</p>

          <div class="dimension-list">
            <div v-for="dimension in dimensions" :key="dimension.key" class="dimension-row">
              <div>
                <strong>{{ dimension.label }}</strong>
                <span>{{ dimension.description }}</span>
              </div>
              <div class="dimension-meter">
                <span :style="{ width: `${getDimensionPercent(dimension.key)}%` }"></span>
              </div>
              <em>{{ getDimensionPercent(dimension.key) }}%</em>
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
            <h3>你和 {{ result.titleCn }} 的共振点</h3>
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
        <span v-for="character in rankedCharacters.slice(1, 4)" :key="character.id">
          {{ character.name }} {{ character.match }}%
        </span>
      </aside>

      <article ref="posterRef" class="poster" :style="resultThemeStyle" aria-hidden="true">
        <div class="poster-top">
          <span>MITI</span>
          <strong>{{ result.match }}% MATCH</strong>
        </div>
        <div class="poster-art">
          <img
            v-if="shouldShowImage(result)"
            :src="getImageSrc(result)"
            :alt="result.name"
            @error="markImageError(result.id)"
          />
          <div v-else class="portrait-placeholder">
            <span>{{ result.titleEn }}</span>
          </div>
        </div>
        <p class="poster-name">{{ result.name }}</p>
        <h3>{{ result.titleCn }}</h3>
        <p class="poster-en">{{ result.titleEn }}</p>
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
