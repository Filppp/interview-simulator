import { chatCompletion } from './llm'
import { fmtDurationZh } from '../shared/format'
import type { AskPayload, ChatMessage, InterviewStyle, InterviewStage } from '../shared/types'

const PRESET_DESC: Record<InterviewStyle['preset'], string> = {
  gentle: '温和引导型：语气亲切、多肯定和鼓励，答错时先认可努力再委婉纠正，不施压，节奏舒缓，适合初次练习。',
  standard: '标准型：礼貌正式、节奏适中，像真实复试一般客观，追问适度，不刻意施压也不过分宽松。',
  strict: '压力型：语速偏快、气场严肃，会连续追问、适当打断并质疑回答的漏洞，考察考生的临场应变与抗压能力。',
  academic: '学术深挖型：重点关注原理深度与逻辑严密性，偏好追问"为什么""推导一下""和前沿的联系"，不满足于表面回答。'
}

const STAGE_ROLES: Record<InterviewStage, { role: string; lang: 'zh' | 'en' }> = {
  intro: { role: '研究生复试面试官（中文）', lang: 'zh' },
  english: { role: '研究生复试英语口语考官', lang: 'en' },
  major: { role: '研究生复试专业课面试官（教授）', lang: 'zh' },
  resume: { role: '研究生复试综合面试官（针对简历深挖）', lang: 'zh' }
}

function levelLabel(v: number, words: [string, string, string, string, string]): string {
  return words[Math.min(4, Math.max(0, v - 1))]
}

function styleInstruction(style: InterviewStyle): string {
  const parts: string[] = []
  parts.push(`整体风格：${PRESET_DESC[style.preset]}`)
  parts.push(`追问深度（1-5，当前 ${style.followUpDepth}）：${levelLabel(style.followUpDepth, ['几乎不追问', '偶尔简单追问', '常规追问一层', '追问到细节与依据', '穷追不舍，追问到数据/推导/反例'])}`)
  parts.push(`英语难度（1-5，当前 ${style.englishDifficulty}）：${levelLabel(style.englishDifficulty, ['词汇简单、语速慢、句子短', '常用四级词汇、清晰缓慢', '常规学术表达、正常语速', '较难的学术词汇与复杂句式', '接近 native 的快速流畅表达'])}`)
  parts.push(`压力程度（1-5，当前 ${style.pressureLevel}）：${levelLabel(style.pressureLevel, ['全程温和，绝不打断', '很少打断，给足思考时间', '偶尔打断纠正，正常施压', '经常打断追问，明显施压', '高强度施压，连环追问、质疑答案'])}`)
  if (style.customNote.trim()) {
    parts.push(`面试官额外要求（务必遵守）：${style.customNote.trim()}`)
  }
  return parts.join('\n')
}

function stageRules(stage: InterviewStage, payload: AskPayload): string {
  const { questionIndex, totalQuestions, intent } = payload
  const q = questionIndex + 1
  const lang = STAGE_ROLES[stage].lang === 'en' ? 'English' : '中文'
  const ctx = payload.stageContext.trim()
  const rules: string[] = []
  rules.push(`当前环节：${stageLabel(stage)}；全程使用${lang}交流（环节名称和规则说明除外）。`)
  rules.push('')
  rules.push(ctx ? `【本环节可用资料】\n"""\n${ctx}\n"""\n出题与追问应尽量结合以上资料；资料不足时出通用问题。` : '（本环节没有可用的资料，请出通用问题）')
  switch (stage) {
    case 'intro':
      rules.push(`面试开始，请用一两句话自然开场，然后请考生做自我介绍（时长约 ${fmtDurationZh(payload.introSeconds)}）。`)
      rules.push(`intent=${intent}：`)
      rules.push('- question：发出自我介绍邀请（不要替考生介绍）。')
      rules.push('- answer：考生自我介绍已结束，请基于其内容简短点评，然后追问 1 个相关问题（如项目细节/为什么选这个方向）。')
      rules.push('- introFollowup：针对考生自我介绍内容继续追问 1 个问题，或自然收尾并提示进入下一环节。')
      return rules.join('\n')
    case 'english':
      rules.push(`这是第 ${q}/${totalQuestions} 道英语口语题。`)
      rules.push('题目来源：英语面试常用话题（自我介绍、家乡、学校、专业兴趣、读研规划、时事观点等），结合资料中的词汇与话题。')
      rules.push(`intent=${intent}：`)
      rules.push('- question：出一道具体、可回答的英语口语题（1-2 句），不要替考生作答。')
      rules.push('- answer：用 1-2 句英语简短点评考生回答，然后追问 1 个相关问题（控制在 2 句内）。')
      if (payload.answersThisQuestion >= 2) {
        rules.push('（考生本问题已回答 ≥2 轮：本次只需点评并自然收尾本题，提示可以进入下一题。）')
      }
      rules.push('- hint：考生请求提示，用英语给 2-3 个关键词或思路引导（不要直接给完整答案）。')
      rules.push('- skip：换一题，直接出一道新的英语口语题。')
      rules.push('若这是最后一题的追问且考生已充分作答，可自然收尾。')
    case 'major':
      rules.push(`这是第 ${q}/${totalQuestions} 道专业题。`)
      rules.push(`intent=${intent}：`)
      rules.push('- question：基于资料出一道专业课问题（概念理解或应用分析），难度适中，1-2 句。')
      rules.push('- answer：点评考生回答的正确性（指出对/错/不足），然后根据追问深度决定是否追问 1 个更深的问题。')
      if (payload.answersThisQuestion >= 2) {
        rules.push('（考生本问题已回答 ≥2 轮：本次只需点评并自然收尾本题，提示可以进入下一题。）')
      }
      rules.push('- hint：给考生 1-2 条提示（关键词、思路或公式方向），不要直接给完整答案。')
      rules.push('- skip：换一题，基于资料另出一道专业课问题。')
      rules.push('若这是最后一题的追问且考生已充分作答，可自然收尾。')
      return rules.join('\n')
    case 'resume':
      rules.push(`这是第 ${q}/${totalQuestions} 个简历相关问题。`)
      rules.push('简历内容：' + (ctx || '（无简历，出通用综合问题）'))
      if (payload.selfIntro) rules.push(`考生自我介绍原文："""\n${payload.selfIntro}\n"""`)
      rules.push('提问重点：项目/科研经历细节（角色、难点、成果、数据）、简历疑点、读研动机与规划、本科经历。')
      rules.push(`intent=${intent}：`)
      rules.push('- question：基于简历提出一个具体问题。')
      rules.push('- answer：点评后视情况追问 1 个相关细节问题。')
      if (payload.answersThisQuestion >= 2) {
        rules.push('（考生本问题已回答 ≥2 轮：本次只需点评并自然收尾本题，提示可以进入下一题。）')
      }
      rules.push('- hint：提示 1-2 条回答思路。')
      rules.push('- skip：换一个简历问题。')
      return rules.join('\n')
  }
}

function stageLabel(stage: InterviewStage): string {
  return { intro: '自我介绍', english: '英语口语问答', major: '专业课问答', resume: '简历提问' }[stage]
}

/** 构造面试官系统提示词 */
function buildSystemPrompt(payload: AskPayload): string {
  const { stage, style, schoolNotes } = payload
  const role = STAGE_ROLES[stage]

  const parts: string[] = []
  parts.push(`你是一名${role.role}，正在对一位考生进行研究生复试/保研模拟面试。`)
  parts.push('你的职责：像真实考官一样提问、追问与简短点评，帮助考生练习。')
  parts.push('')
  parts.push('【面试官风格要求】')
  parts.push(styleInstruction(style))
  if (schoolNotes.trim()) {
    parts.push('')
    parts.push('【报考学校面试风格参考（来自学长学姐的经验，请尽量贴合该校真实风格）】')
    parts.push(schoolNotes.trim())
  }
  parts.push('')
  parts.push('【本环节规则】')
  parts.push(stageRules(stage, payload))
  parts.push('')
  parts.push('【输出要求】')
  parts.push('- 只输出面试官"说出口"的话，不要任何解释、标注、引号或角色名。')
  parts.push('- 每次发言控制在 120 字以内（英语 60 词以内），口语化、自然。')
  parts.push('- 不要替考生作答，不要连续替考生铺路。')
  parts.push('- 面试全程严禁直接给出参考答案、标准答案或完整答案；点评只针对答题方向与表现（如"结构还可以更清晰"），绝不展示正确答案内容；考生请求"提示"时也只能给方向性关键词，不能写完整答案。')
  if (payload.intent === 'hint') {
    parts.push('- 本次为【提示请求】：只给出 1-2 条简洁的思考方向/关键词/公式提示，不要点评、不要追问、不要替考生组织答案。')
  }
  return parts.join('\n')
}

/** 面试官对话：返回 AI 回复文本 */
export async function askInterviewer(payload: AskPayload): Promise<string> {
  const system = buildSystemPrompt(payload)
  const messages: ChatMessage[] = [{ role: 'assistant', content: system }, ...payload.history]
  const temperature = payload.style.pressureLevel >= 4 ? 0.5 : 0.8
  return chatCompletion(messages, { maxTokens: 400, temperature })
}

export { PRESET_DESC }
