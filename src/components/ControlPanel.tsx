import { ChevronDownIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DATASETS } from '@/data/datasets'
import type { DatasetId } from '@/engine/types'
import { appStore, useApp } from '@/store'
import { LABEL_LIMIT, MAX_DISTANCE, MAX_IMPROVE_ROUNDS, MAX_RANDOM_NODES, type SourceKind } from '@/store/appStore'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Field({ id, label, value, children }: { id: string; label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {value !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  )
}

/** Number input that only commits valid values; shows the stored value again on blur. */
function NumberInput({ id, value, min, max, disabled, onCommit }: { id: string; value: number; min: number; max: number; disabled?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      disabled={disabled}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== '') onCommit(Number(draft))
        setDraft(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

export function ControlPanel() {
  const { t } = useTranslation()
  const sourceKind = useApp((s) => s.sourceKind)
  const random = useApp((s) => s.random)
  const datasetId = useApp((s) => s.datasetId)
  const d = useApp((s) => s.d)
  const busy = useApp((s) => s.busy)
  const graph = useApp((s) => s.graph)
  const coloring = useApp((s) => s.coloring)
  const display = useApp((s) => s.display)
  const [improveRounds, setImproveRounds] = useState(5)
  const actions = appStore.getState()
  const labelsOn = display.showLabels ?? (graph ? graph.n <= LABEL_LIMIT : true)

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b p-4 md:w-72 md:border-r md:border-b-0">
      <Section title={t('graph.heading')}>
        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full"
          value={sourceKind}
          onValueChange={(value) => value && actions.setSourceKind(value as SourceKind)}
        >
          <ToggleGroupItem value="random" className="flex-1" aria-label={t('graph.random')}>
            {t('graph.random')}
          </ToggleGroupItem>
          <ToggleGroupItem value="dataset" className="flex-1" aria-label={t('graph.dataset')}>
            {t('graph.dataset')}
          </ToggleGroupItem>
        </ToggleGroup>

        {sourceKind === 'random' ? (
          <>
            <Field id="nodes" label={t('graph.nodes')} value={random.n}>
              <Slider
                id="nodes"
                thumbLabel={t('graph.nodes')}
                min={1}
                max={MAX_RANDOM_NODES}
                step={1}
                value={[random.n]}
                onValueChange={([n]) => actions.setRandom({ n })}
              />
            </Field>
            <Field id="density" label={t('graph.density')} value={random.p.toFixed(2)}>
              <Slider
                id="density"
                thumbLabel={t('graph.density')}
                min={0.01}
                max={1}
                step={0.01}
                value={[random.p]}
                onValueChange={([p]) => actions.setRandom({ p: Math.round(p * 100) / 100 })}
              />
            </Field>
            <Field id="seed" label={t('graph.seed')}>
              <NumberInput id="seed" value={random.seed} min={0} max={Number.MAX_SAFE_INTEGER} onCommit={(seed) => actions.setRandom({ seed })} />
            </Field>
            <Button disabled={busy} onClick={() => void actions.generate()}>
              {t('graph.generate')}
            </Button>
          </>
        ) : (
          <>
            <Field id="dataset" label={t('graph.dataset')}>
              <Select value={datasetId} onValueChange={(value) => actions.setDataset(value as DatasetId)}>
                <SelectTrigger id="dataset" className="w-full" aria-label={t('graph.dataset')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATASETS.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {t('graph.datasetOption', { name: dataset.id, count: dataset.vertices })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button disabled={busy} onClick={() => void actions.generate()}>
              {t('graph.load')}
            </Button>
          </>
        )}
      </Section>

      <Separator />

      <Section title={t('coloring.heading')}>
        <Field id="distance" label={t('coloring.distance')}>
          <NumberInput id="distance" value={d} min={1} max={MAX_DISTANCE} disabled={busy} onCommit={(value) => void actions.setDistance(value)} />
        </Field>
        <Button disabled={busy || !graph} onClick={() => void actions.color()}>
          {t('coloring.color')}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy || !coloring}
            onClick={() => void actions.improve(improveRounds)}
          >
            {t('coloring.improve', { count: improveRounds })}
          </Button>
          <div className="w-20">
            <NumberInput
              id="improve-rounds"
              value={improveRounds}
              min={1}
              max={MAX_IMPROVE_ROUNDS}
              onCommit={(value) => {
                if (Number.isInteger(value) && value >= 1 && value <= MAX_IMPROVE_ROUNDS) setImproveRounds(value)
              }}
            />
          </div>
        </div>
      </Section>

      <Separator />

      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('display.heading')}
          <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 flex flex-col gap-3">
          <Field id="node-size" label={t('display.nodeSize')} value={display.nodeSize}>
            <Slider id="node-size" thumbLabel={t('display.nodeSize')} min={1} max={15} step={1} value={[display.nodeSize]} onValueChange={([nodeSize]) => actions.setDisplay({ nodeSize })} />
          </Field>
          <div className="flex items-center justify-between">
            <Label htmlFor="labels">{t('display.labels')}</Label>
            <Switch id="labels" checked={labelsOn} onCheckedChange={(showLabels) => actions.setDisplay({ showLabels })} />
          </div>
          <Field id="edge-opacity" label={t('display.edgeOpacity')} value={display.edgeOpacity.toFixed(2)}>
            <Slider
              id="edge-opacity"
              thumbLabel={t('display.edgeOpacity')}
              min={0.05}
              max={1}
              step={0.05}
              value={[display.edgeOpacity]}
              onValueChange={([edgeOpacity]) => actions.setDisplay({ edgeOpacity })}
            />
          </Field>
          <Button variant="outline" disabled={!graph} onClick={() => actions.relayout()}>
            {t('display.relayout')}
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </aside>
  )
}
