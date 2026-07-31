// Source of truth for message shape — en.ts is typed against this, so a missing
// translation fails to compile rather than silently rendering a key.
export const zh = {
  common: {
    cancel: '取消',
    confirm: '确定',
    close: '关闭',
    loading: '加载中…',
    copy: '复制链接',
    done: '完成',
    retry: '重试',
    language: '语言',
  },

  auth: {
    signInTitle: '登录 idea',
    username: '用户名',
    password: '密码',
    signIn: '登录',
    signingIn: '登录中…',
    signOut: '退出登录',
    // Shown for any failed sign-in. Deliberately one message for both an unknown
    // username and a wrong password — the server refuses to distinguish them, and
    // saying more here would undo that.
    signInFailed: '用户名或密码不正确',
  },

  invite: {
    title: '邀请成员',
    description: '生成一条邀请链接发给对方。链接不绑定任何身份，谁拿到谁能用，且只能使用一次。',
    generate: '生成邀请链接',
    generating: '生成中…',
    copyNow: '请立即复制。关闭后无法再次查看这条链接。',
    failed: '生成邀请失败',
    invalid: '邀请链接无效',
    invalidHint: '链接可能已被使用、已过期，或输入有误。请向邀请人索取新链接。',
    checking: '正在检查邀请…',
    joinTitle: '加入「{0}」',
    invitedBy: '{0} 邀请你加入这个工作空间',
    signedInAs: '你已登录为 {0}，将以当前账号加入。',
    name: '姓名',
    usernameHint: '登录用，小写字母、数字与 . _ -',
    passwordHint: '至少 8 位',
    phone: '手机号（选填）',
    phoneHint: '以后用于找回密码',
    join: '加入',
    registerAndJoin: '注册并加入',
    processing: '处理中…',
    acceptFailed: '接受邀请失败',
    usernameTaken: '该用户名已被占用',
  },

  // Names of the things the main area can show. Keyed by resource kind, so the
  // registry in shell/resources can label a tab from data alone.
  resource: {
    home: '首页',
    requirements: '需求',
    apps: '应用',
    conversations: '会话',
    members: '成员',
    settings: '设置',
  },

  shell: {
    placeholder: '这块还没做，等模型定下来再填。',
    emptyMain: '从左侧选一个开始',
    unknownResource: '找不到「{0}」',
    closeTab: '关闭标签页',
    collapseSide: '收起侧栏',
    expandSide: '展开侧栏',
    collapseConversation: '收起会话',
    expandConversation: '展开会话',
    newConversation: '新会话',
    noConversation: '选一个会话，或新建一个',
    loadMore: '查看更多',
    loadEarlier: '加载更早的消息',
    thinking: '正在思考…',
    withdrawQueued: '撤回这条排队消息',
    withdrawQueuedFailed: '撤回失败，请重试',
    queued: '排队中 · {0}',
    composerPlaceholder: '说说你想要什么…  Enter 发送',
    send: '发送',
    attachFiles: '添加附件',
    removeAttachment: '移除附件',
    retryUpload: '重新上传',
    uploadFailed: '上传失败',
    attachmentLimit: '每条消息最多添加 {0} 个附件',
    allApps: '全部应用',
    yesterday: '昨天',
    dashboardEmpty: '应用首页',
    appNotFound: '找不到这个应用',
    backToApps: '返回全部应用',
  },

  // The transcript's own vocabulary: what a folded group of the agent's
  // working-out says about itself before anyone opens it.
  transcript: {
    you: '你',
    thinking: '思考',
    step: '{0} 步',
    steps: '{0} 步',
    failed: '{0} 失败',
    running: '运行中',
    expandActivity: '展开过程',
    collapseActivity: '折叠过程',
  },

  workspace: {
    noneTitle: '你还不属于任何工作空间',
    noneHint: '请联系管理员邀请你加入。收到邀请链接后打开即可进入。',
    admin: '管理员',
    member: '成员',
    management: '空间管理',
    backToWorkbench: '返回工作台',
    membersPlaceholder: '成员列表将在后续任务中实现',
  },

  app: {
    heading: '应用',
    create: '新建应用',
    creating: '创建中…',
    empty: '还没有应用',
    name: '名称',
    namePlaceholder: '例如：报销审批',
    slug: 'URL 标识',
    slugPlaceholder: '例如：expense-approval',
    description: '简介（选填）',
    descriptionPlaceholder: '这个应用是给谁用的、解决什么问题',
    createdAt: '创建于 {0}',
    status: {
      draft: '草稿',
      active: '使用中',
      archived: '已归档',
    },
    error: {
      // Keyed by the envelope's `code`, so the same conflict reads correctly in
      // each context rather than showing the server's English sentence.
      app_name_taken: '已存在同名应用',
      app_slug_taken: '该 URL 标识已被占用',
      forbidden: '你没有权限执行这个操作',
      not_found: '应用不存在',
      fallback: '创建失败，请重试',
    },
  },

  error: {
    unauthorized: '登录已过期，请重新登录',
    forbidden: '你没有权限执行这个操作',
    not_found: '内容不存在',
    conflict: '操作与当前状态冲突',
    bad_request: '请求有误',
    internal: '服务异常，请稍后重试',
    network: '网络异常，请检查连接',
    fallback: '操作失败，请重试',
  },
}
