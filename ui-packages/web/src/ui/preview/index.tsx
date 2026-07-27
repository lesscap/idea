import { useState } from 'react'
import { Badge } from '../badge/index.tsx'
import { Button } from '../button/index.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../card/index.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../dialog/index.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu/index.tsx'
import { Input } from '../input/index.tsx'
import { Label } from '../label/index.tsx'

// A gallery of every primitive in its full state matrix. Running the real app
// only ever shows the states that application happens to use, so a broken
// `disabled` style or a variant nobody currently renders goes unnoticed until
// someone reaches for it.
//
// Sits next to the primitives rather than in features/ or a dev/ directory:
// changing a component and its preview should be one place, or the preview rots.
//
// Served at /dev/ui in every environment. It reads no data and exposes nothing,
// and being reachable in production is what makes it useful for checking how a
// deployed build actually renders.

const VARIANTS = ['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const
const SIZES = ['sm', 'default', 'lg', 'icon'] as const

const Section = ({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) => (
  <section className="flex flex-col gap-3">
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
    <div className="rounded-lg border border-border bg-background p-4">{children}</div>
  </section>
)

export const UiPreview = () => {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 p-8">
      <header>
        <h1 className="text-2xl font-semibold">UI primitives</h1>
        <p className="text-sm text-muted-foreground">
          改动 src/ui 下的组件后，先在这里看一眼各状态。
        </p>
      </header>

      <Section title="Button" note="6 variants × 4 sizes, plus disabled">
        <div className="flex flex-col gap-4">
          {VARIANTS.map(variant => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <code className="w-24 shrink-0 text-xs text-muted-foreground">{variant}</code>
              {SIZES.map(size => (
                <Button key={size} variant={variant} size={size}>
                  {size === 'icon' ? '★' : size}
                </Button>
              ))}
              <Button variant={variant} disabled>
                disabled
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Input / Label" note="normal, invalid, disabled">
        <div className="grid max-w-md gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-normal">正常</Label>
            <Input id="p-normal" placeholder="placeholder" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-invalid">错误态</Label>
            <Input id="p-invalid" aria-invalid defaultValue="不合法的值" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-disabled">禁用</Label>
            <Input id="p-disabled" disabled defaultValue="改不了" />
          </div>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="destructive">destructive</Badge>
        </div>
      </Section>

      <Section title="Card">
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>标题</CardTitle>
            <CardDescription>一句说明文字。</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">内容区。</CardContent>
        </Card>
      </Section>

      <Section
        title="Dialog"
        note="按 Esc 关闭；Tab 应被锁在弹窗内；关闭后焦点回到触发按钮 —— 这是选 Radix 而非手写的理由，值得每次改动后手验一次"
      >
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">打开弹窗</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>弹窗标题</DialogTitle>
              <DialogDescription>用 Tab 试试焦点能不能跑出去。</DialogDescription>
            </DialogHeader>
            <Input placeholder="第一个可聚焦元素" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={() => setDialogOpen(false)}>确定</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title="DropdownMenu" note="方向键导航，Esc 关闭">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">打开菜单</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>分组标题</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>第一项</DropdownMenuItem>
            <DropdownMenuItem>第二项</DropdownMenuItem>
            <DropdownMenuItem disabled>禁用项</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>
    </main>
  )
}
