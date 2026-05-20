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
  <main class="app-shell">
    <header class="topbar">
      <button class="brand" type="button" @click="view = 'home'">
        <span class="brand-mark">M</span>
        <span>MITI</span>
      </button>
      <div class="nav-meta">
        <span>三游人格测试</span>
        <span>{{ characters.length }} 位角色</span>
        <span>{{ questions.length }} 道题</span>
      </div>
    </header>

    <section v-if="view === 'home'" class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Mihoyo Inspired Type Indicator</p>
        <h1>测一测，你会与哪位角色共鸣。</h1>
        <p class="hero-text">
          回答一组偏好题，MITI 会根据羁绊、秩序、自由、洞察、锋芒和幻面六个维度，在星铁、原神与绝区零角色中匹配最接近你的画像。
        </p>
        <div class="hero-actions">
          <button class="primary-button" type="button" @click="startTest">开始测试</button>
          <button v-if="isComplete" class="ghost-button" type="button" @click="showResultIfReady">查看上次结果</button>
        </div>
      </div>

      <div class="character-showcase" aria-label="角色预览">
        <section v-for="group in groupedCharacters" :key="group.game" class="game-section">
          <div class="game-heading">
            <h2>{{ group.label }}</h2>
            <span>{{ group.characters.length }} 位角色</span>
          </div>
          <div class="game-character-grid">
            <article
              v-for="character in group.characters"
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
                <span v-else>{{ character.name }}</span>
              </div>
              <strong>{{ character.name }}</strong>
              <small>{{ character.title }}</small>
            </article>
          </div>
        </section>
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
