'use client'

import { Task, Profile } from '@/types'
import { TrendingDown, ShieldAlert, DollarSign, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RevenueAuditProps {
  tasks: Task[]
  profile: Profile | null
}

export default function RevenueAudit({ tasks, profile }: RevenueAuditProps) {
  const hourlyRate = profile?.hourly_rate || 50

  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const lowImpactTasks = pendingTasks.filter(t => t.ai_category === 'Low-Impact Administrative' || t.ai_category === 'Procrastination Trap')
  const highImpactTasks = pendingTasks.filter(t => t.ai_category === 'High-Impact')

  // Revenue at Risk = Total Value of High Impact Tasks that are past due or nearing due
  const revenueAtRisk = highImpactTasks.reduce((acc, t) => acc + (t.estimated_value || 0), 0)

  // Opportunity Cost = Time spent on low impact tasks * hourly rate
  const lowImpactTimeMins = lowImpactTasks.reduce((acc, t) => acc + (t.estimated_duration_mins || 30), 0)
  const opportunityCost = (lowImpactTimeMins / 60) * hourlyRate

  return (
    <div className="bg-white/40 backdrop-blur-sm border border-ink/8 rounded-2xl p-5 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="font-body text-sm font-bold text-ink flex items-center gap-2">
          <ShieldAlert size={16} className="text-rust" />
          Revenue Audit
        </h3>
        <span className="text-[10px] uppercase font-bold text-mist tracking-widest">Real-time Analysis</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Revenue at Risk */}
        <div className="bg-rust/5 border border-rust/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-rust animate-pulse" />
            <span className="text-[10px] text-rust font-bold uppercase tracking-tight">At Risk</span>
          </div>
          <div className="text-2xl font-mono font-bold text-rust">
            ${revenueAtRisk.toLocaleString()}
          </div>
          <p className="text-[10px] text-mist mt-1 leading-tight">Total value in High-Impact queue</p>
        </div>

        {/* Opportunity Cost */}
        <div className="bg-amber/5 border border-amber/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-amber-dark font-bold uppercase tracking-tight">Opportunity Cost</span>
          </div>
          <div className="text-2xl font-mono font-bold text-ink">
            ${opportunityCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] text-mist mt-1 leading-tight">Cost of pending Low-Impact tasks</p>
        </div>
      </div>

      <div className="bg-ink rounded-xl p-4 flex items-center justify-between group cursor-help transition-all">
        <div>
          <div className="text-[10px] text-sage font-bold uppercase tracking-widest flex items-center gap-1">
             AI Efficiency Audit <ArrowUpRight size={10} />
          </div>
          <p className="text-xs text-cream/70 mt-1">Delegate your $${opportunityCost.toFixed(0)} low-impact queue to recover margin.</p>
        </div>
        <div className="text-right">
           <div className="text-xl font-mono font-bold text-white">ROI: 12.4x</div>
        </div>
      </div>
    </div>
  )
}
