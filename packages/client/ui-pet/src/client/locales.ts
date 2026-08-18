import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace owned by the whale pet. */
export const NS = 'pet' as const

/** Translation keys rendered by the whale overlay. */
export type PetKey =
  | 'label'
  | 'state.failed'
  | 'state.idle'
  | 'state.jumping'
  | 'state.review'
  | 'state.running'
  | 'state.runningLeft'
  | 'state.runningRight'
  | 'state.waiting'
  | 'state.waving'
  | 'state.looking'
  | 'speech.idle'
  | 'speech.waving'
  | 'speech.jumping'
  | 'speech.thinking'
  | 'speech.generating'
  | 'speech.running'
  | 'speech.review'
  | 'speech.waitingApproval'
  | 'speech.error'
  | 'speech.tool.reading'
  | 'speech.tool.writing'
  | 'speech.tool.command'
  | 'speech.tool.search'
  | 'speech.tool.git'
  | 'speech.tool.web'
  | 'speech.tool.generic'
  | 'speech.errorDetail'
  | 'speech.tool.readingDetail'
  | 'speech.tool.writingDetail'
  | 'speech.tool.commandDetail'
  | 'speech.tool.searchDetail'
  | 'speech.tool.gitDetail'
  | 'speech.tool.webDetail'
  | 'speech.tool.genericDetail'
  | 'speech.thinkingDetail'
  | 'speech.generatingDetail'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    pet: PetKey
  }
}

/** Simplified Chinese pet labels. */
export const zh: LocaleDictOf<typeof NS> = {
  'label': 'DeepSeek 蓝鲸宠物：{state}',
  'state.failed': '任务失败',
  'state.idle': '休息中',
  'state.jumping': '跳跃',
  'state.review': '检查结果',
  'state.running': '处理中',
  'state.runningLeft': '向左移动',
  'state.runningRight': '向右移动',
  'state.waiting': '等待你的操作',
  'state.waving': '向你打招呼',
  'state.looking': '看向指针',
  'speech.idle': '随时待命，呼唤我开始编程吧 🌊',
  'speech.waving': '你好呀！我是你的 DeepSeek 蓝鲸伙伴 🐳',
  'speech.jumping': '嘿咻！有什么我可以帮你的吗？ ✨',
  'speech.thinking': 'DeepSeek 正在深度思考中 💭',
  'speech.generating': 'DeepSeek 正在编写代码与解答 ✍️',
  'speech.running': '正在全力执行任务中 🚀',
  'speech.review': '搞定啦！已完成本轮任务 🎉',
  'speech.waitingApproval': '需要你的确认与审批哦 🔔',
  'speech.error': '哎呀，遇到了一点小麻烦 ❌',
  'speech.tool.reading': '正在仔细阅读代码文件 📖',
  'speech.tool.writing': '正在编写并修改文件 📝',
  'speech.tool.command': '正在终端执行命令 ⚙️',
  'speech.tool.search': '正在检索代码与项目内容 🔍',
  'speech.tool.git': '正在处理 Git 版本变更 🌿',
  'speech.tool.web': '正在联网检索相关信息 🌐',
  'speech.tool.generic': '正在调用工具 {tool} ...',
  'speech.errorDetail': '❌ 异常：{detail}',
  'speech.tool.readingDetail': '📖 阅读：{target}',
  'speech.tool.writingDetail': '✍️ 编写：{target}',
  'speech.tool.commandDetail': '⚙️ 执行：{target}',
  'speech.tool.searchDetail': '🔍 检索：{target}',
  'speech.tool.gitDetail': '🌿 Git：{target}',
  'speech.tool.webDetail': '🌐 检索：{target}',
  'speech.tool.genericDetail': '⚙️ {tool}：{target}',
  'speech.thinkingDetail': '💭 {text}',
  'speech.generatingDetail': '✨ {text}',
}

/** English pet labels. */
export const en: LocaleDictOf<typeof NS> = {
  'label': 'DeepSeek whale pet: {state}',
  'state.failed': 'task failed',
  'state.idle': 'resting',
  'state.jumping': 'jumping',
  'state.review': 'reviewing the result',
  'state.running': 'working',
  'state.runningLeft': 'moving left',
  'state.runningRight': 'moving right',
  'state.waiting': 'waiting for you',
  'state.waving': 'waving hello',
  'state.looking': 'looking at the pointer',
  'speech.idle': 'Ready to help! Call me to start coding 🌊',
  'speech.waving': 'Hello! I am your DeepSeek whale companion 🐳',
  'speech.jumping': 'Hey! How can I assist you today? ✨',
  'speech.thinking': 'DeepSeek is thinking deeply 💭',
  'speech.generating': 'DeepSeek is writing code and responses ✍️',
  'speech.running': 'Working hard on your task 🚀',
  'speech.review': 'Done! The task has been completed 🎉',
  'speech.waitingApproval': 'Waiting for your approval 🔔',
  'speech.error': 'Oops, encountered an issue ❌',
  'speech.tool.reading': 'Reading code files 📖',
  'speech.tool.writing': 'Writing and editing files 📝',
  'speech.tool.command': 'Executing terminal command ⚙️',
  'speech.tool.search': 'Searching codebase 🔍',
  'speech.tool.git': 'Processing Git changes 🌿',
  'speech.tool.web': 'Searching the web 🌐',
  'speech.tool.generic': 'Running tool {tool}...',
  'speech.errorDetail': '❌ Error: {detail}',
  'speech.tool.readingDetail': '📖 Reading: {target}',
  'speech.tool.writingDetail': '✍️ Writing: {target}',
  'speech.tool.commandDetail': '⚙️ Running: {target}',
  'speech.tool.searchDetail': '🔍 Searching: {target}',
  'speech.tool.gitDetail': '🌿 Git: {target}',
  'speech.tool.webDetail': '🌐 Searching: {target}',
  'speech.tool.genericDetail': '⚙️ {tool}: {target}',
  'speech.thinkingDetail': '💭 {text}',
  'speech.generatingDetail': '✨ {text}',
}
