export type DemoRequirementContent = {
  readonly title: string
  readonly summary: string
  readonly body: string
}

export type DemoRequirementRevision = DemoRequirementContent & {
  readonly number: number
}

export type DemoRequirementDraft = DemoRequirementContent & {
  readonly version: number
}

export type DemoRequirement = {
  readonly number: number
  readonly status: 'draft' | 'active' | 'archived'
  readonly revisionSequence: number
  readonly currentRevisionNumber: number | null
  readonly revisions: readonly DemoRequirementRevision[]
  readonly draft: DemoRequirementDraft | null
}

const topics = [
  ['请假申请与审批流程', '员工提交请假申请后，由直属负责人审核并返回明确结果。'],
  ['年假余额与可用天数校验', '提交年假前校验剩余额度，避免申请超过当前可用天数。'],
  ['病假证明材料补交', '病假超过规定天数时允许先提交申请，并在期限内补交证明。'],
  ['纸质请假单归档', '保留旧纸质请假单的归档查询能力，供历史审计使用。'],
  ['半天与跨天请假时长计算', '准确计算半天、跨工作日及跨月请假的实际时长。'],
  ['请假审批通知', '申请、通过、驳回和撤回时通知申请人与相关审批人。'],
  ['部门负责人二级审批', '长时间请假在直属负责人通过后继续流转给部门负责人。'],
  ['陪产假资格信息收集', '申请陪产假时收集资格日期和必要的证明信息。'],
  ['调休余额扣减', '调休申请通过后扣减余额，撤销后恢复对应额度。'],
  ['撤回与重新提交', '审批完成前允许员工撤回申请，修改后重新进入审批。'],
  ['审批超时提醒', '审批任务超过约定时限后提醒当前审批人和申请人。'],
  ['旧版短信审批入口', '记录已停用的短信审批入口及其历史数据保留规则。'],
  ['节假日与周末排除', '计算请假时长时自动排除法定节假日和非工作日。'],
  ['婚假证明材料', '婚假申请保存证明材料及登记日期，供审批时查看。'],
  ['多时区员工请假日期', '跨时区员工按所属工作地点解释请假起止日期。'],
  ['日历同步', '审批通过后将请假时间同步到团队日历并支持后续更新。'],
  ['请假记录导出', '按日期、部门和状态筛选并导出请假记录。'],
  ['代理审批人', '审批人休假期间将待办转交给已配置的代理审批人。'],
  ['育儿假分段申请', '支持在可用周期内分多次申请育儿假并累计已用额度。'],
  ['审批意见与驳回原因', '审批操作记录意见，驳回时必须提供可执行的原因。'],
  ['员工请假额度展示', '员工可以查看各假期类型的总额度、已用和可用额度。'],
  ['批量审批', '审批人可批量处理规则一致的多条请假申请。'],
  ['请假冲突提示', '申请时间与已有请假或关键排班冲突时给出明确提示。'],
  ['审批审计日志', '完整记录申请和审批状态变化，支持按操作人和时间查询。'],
  [
    '需求正文内图片与富内容',
    '需求正文支持私有图片、数学公式、代码高亮和 Mermaid 图，并保持一致的 Markdown 能力。',
  ],
  ['需求附件管理', '需求可以关联补充材料，并在正文之后集中展示和打开。'],
] as const

const draftOnly = new Set([3, 8, 14, 19, 25, 26])
const activeWithDraft = new Set([1, 6, 10, 16, 20, 23])
const archived = new Set([4, 12])
const secondRevision = new Set([1, 2, 5, 10, 17, 22])

const content = (title: string, summary: string, note: string): DemoRequirementContent => ({
  title,
  summary,
  body: `## 目标\n\n${summary}\n\n## 业务规则\n\n- ${note}\n- 所有状态变化都需要保留操作时间和操作人。\n- 校验失败时向用户说明原因，并保留已填写的内容。\n\n## 验收标准\n\n- 正常流程可以完成并展示最终状态。\n- 不满足规则的操作不会写入无效数据。`,
})

const richContent = (number: number, title: string, summary: string): DemoRequirementContent => {
  if (number === 25) {
    return {
      title,
      summary,
      body: `## 目标

需求正文使用与会话一致的 Markdown 渲染能力，并允许把已上传到当前应用的私有图片放在准确的叙述位置。

![请假申请状态流转示意图](idea-file:demo-req-flow)

## 内容能力

- 支持 GFM 表格、任务列表与链接。
- 行内公式示例：$T = \\sum_{i=1}^{n} d_i$。
- 块级公式：

$$
R = \\frac{\\text{已审批申请数}}{\\text{申请总数}}
$$

### 代码语法高亮

\`\`\`typescript
type LeaveRequest = {
  readonly days: number
  readonly reason: string
}

const canSubmit = (request: LeaveRequest) =>
  request.days > 0 && request.reason.trim().length > 0
\`\`\`

### Mermaid 流程图

\`\`\`mermaid
flowchart LR
  A[填写申请] --> B{校验通过?}
  B -- 是 --> C[提交审批]
  B -- 否 --> D[保留内容并提示]
\`\`\`

## 验收标准

- 正文图片仅能引用当前应用中已完成上传且明确关联到当前版本的图片。
- 点击正文图片会在应用内打开文件标签页。
- 外部图片地址不会发起加载请求。`,
    }
  }

  if (number === 26) {
    return {
      title,
      summary,
      body: `## 目标

需求可以关联设计说明、接口约定等补充材料，正文保持专注，附件在独立区域集中展示。

## 业务规则

- 每个草稿最多关联 10 个附件，顺序由保存时的引用顺序决定。
- 保存草稿时完整替换附件集合；确认版本时将附件复制为不可变快照。
- 历史版本只展示确认当时关联的附件。
- 点击附件行后在新的资源标签页中打开，沿用已有预览与下载能力。

## 验收标准

- 附件名称和文件大小清晰可见。
- 当前应用以外或尚未上传完成的文件不能被关联。
- 附件关联失败时不写入部分数据。`,
    }
  }

  return content(title, summary, `按照「${title}」的当前规则处理申请。`)
}

export const DEMO_REQUIREMENTS: readonly DemoRequirement[] = topics.map(
  ([title, summary], index) => {
    const number = index + 1
    const current = richContent(number, title, summary)
    const revisions: readonly DemoRequirementRevision[] = draftOnly.has(number)
      ? []
      : secondRevision.has(number)
        ? [
            {
              number: 1,
              ...content(title, `初版：${summary}`, `按照「${title}」的初版规则处理申请。`),
            },
            { number: 2, ...current },
          ]
        : [{ number: 1, ...current }]
    const draft = draftOnly.has(number)
      ? { version: 1, ...current }
      : activeWithDraft.has(number)
        ? {
            version: 1,
            ...content(
              `${title}（调整中）`,
              `${summary} 当前正在补充边界条件。`,
              `在现行版本基础上补充「${title}」的边界条件。`,
            ),
          }
        : null
    const currentRevisionNumber = revisions.at(-1)?.number ?? null

    return {
      number,
      status: draftOnly.has(number) ? 'draft' : archived.has(number) ? 'archived' : 'active',
      revisionSequence: currentRevisionNumber ?? 0,
      currentRevisionNumber,
      revisions,
      draft,
    }
  },
)
