export type DemoIssue = {
  readonly number: number
  readonly title: string
  readonly body: string
  readonly type: 'bug' | 'feature' | 'task' | null
  readonly state: 'open' | 'closed'
  readonly closeReason: 'completed' | 'not_planned' | null
  readonly labels: readonly string[]
}

const issue = (
  number: number,
  title: string,
  summary: string,
  type: DemoIssue['type'],
  labels: readonly string[],
  state: DemoIssue['state'] = 'open',
  closeReason: DemoIssue['closeReason'] = null,
): DemoIssue => ({
  number,
  title,
  type,
  labels,
  state,
  closeReason,
  body: `## 目标\n\n${summary}\n\n## 验收标准\n\n- 正常流程可以完成并展示最终状态。\n- 校验失败时说明原因，并保留用户已填写的内容。`,
})

export const DEMO_ISSUES: readonly DemoIssue[] = [
  issue(1, '请假申请与审批流程', '员工提交申请后，由直属负责人审核并返回明确结果。', 'feature', [
    'workflow',
  ]),
  issue(2, '年假余额与可用天数校验', '提交年假前校验剩余额度。', 'task', ['backend']),
  issue(3, '病假证明材料无法补交', '病假超过规定天数后仍应允许补交证明。', 'bug', [
    'bug',
    'priority-high',
  ]),
  issue(
    4,
    '纸质请假单归档',
    '保留旧纸质请假单的归档查询能力。',
    'task',
    ['documentation'],
    'closed',
    'completed',
  ),
  issue(5, '半天与跨天请假时长计算', '准确计算跨工作日及跨月请假的实际时长。', 'feature', [
    'backend',
  ]),
  issue(6, '请假审批通知', '申请、通过、驳回和撤回时通知相关人员。', 'feature', ['workflow']),
  issue(7, '审批超时提醒', '审批任务超过时限后提醒当前审批人。', 'task', ['priority-high']),
  issue(
    8,
    '旧版短信审批入口',
    '停用旧短信入口并保留历史数据。',
    null,
    ['documentation'],
    'closed',
    'not_planned',
  ),
]

export const DEMO_LABELS = [
  { name: 'bug', description: 'Unexpected behavior', color: 'd1242f' },
  { name: 'backend', description: 'Server-side work', color: '0e8a16' },
  { name: 'documentation', description: 'Documentation improvements', color: '1d76db' },
  { name: 'priority-high', description: 'Needs prompt attention', color: 'b60205' },
  { name: 'workflow', description: 'Approval workflow', color: '8250df' },
] as const
