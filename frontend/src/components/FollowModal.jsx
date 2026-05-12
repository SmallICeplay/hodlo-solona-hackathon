import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'

export default function FollowModal({ item, onClose, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    enabled: true,
    buy_amount: 0.1,
    take_profit: 50,
    stop_loss: 30,
    max_hold_min: 60,
    note: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exists, setExists] = useState(false)

  useEffect(() => {
    fetch(`/api/analytics/caller_detail/${encodeURIComponent(item.qy_wxid)}`)
      .then(r => r.json())
      .then(d => {
        if (d.follow) {
          setForm({
            enabled: d.follow.enabled,
            buy_amount: d.follow.buy_amount,
            take_profit: d.follow.take_profit,
            stop_loss: d.follow.stop_loss,
            max_hold_min: d.follow.max_hold_min,
            note: d.follow.note || '',
          })
          setExists(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [item.qy_wxid])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/analytics/follow_traders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wxid: item.qy_wxid, name: item.name || '', ...form }),
      })
      const d = await r.json()
      if (d.success) { onSaved?.(); onClose() }
      else alert(t('follow_modal.save_failed'))
    } catch (e) { alert(t('follow_modal.save_failed') + ': ' + e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm(t('follow_modal.delete_confirm'))) return
    setDeleting(true)
    try {
      await fetch(`/api/analytics/follow_traders/${encodeURIComponent(item.qy_wxid)}`, { method: 'DELETE' })
      onSaved?.(); onClose()
    } catch (e) { alert(t('follow_modal.delete_failed')) }
    finally { setDeleting(false) }
  }

  return (
    <div className="cp-modal-backdrop fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="web3-frame w-[480px] max-w-[94vw]" onClick={e => e.stopPropagation()}>
        <span className="w3-corners" aria-hidden="true"><i></i></span>
        <div className="web3-frame-inner cp-modal-bg">
          {/* 头部 */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h3 className="cp-modal-title">{t('follow_modal.title')}</h3>
              <p className="cp-modal-subtitle truncate">{item.name || t('leaderboard.anonymous')}</p>
            </div>
            <button onClick={onClose} className="cp-modal-close shrink-0" aria-label={t('common.close')}>×</button>
          </div>
          <div className="cp-modal-divider" />

          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm font-mono tracking-widest uppercase">
              <span className="cp-text-flicker-host">{t('follow_modal.loading')}</span>
            </div>
          ) : (
            <div className="px-6 py-5 space-y-5">
              {/* 启用开关 */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="cp-modal-label !mb-1">{t('follow_modal.enable')}</p>
                  <p className="text-sm text-gray-400 font-mono tracking-wide">{t('follow_modal.enable_desc')}</p>
                </div>
                <button
                  onClick={() => set('enabled', !form.enabled)}
                  className={clsx('cp-toggle shrink-0', form.enabled && 'cp-toggle-on')}
                  aria-pressed={form.enabled}
                >
                  <span className="cp-toggle-knob" />
                </button>
              </div>

              {/* 买入金额 */}
              <div>
                <label className="cp-modal-label">{t('follow_modal.buy_amount')}</label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {[0.05, 0.1, 0.2, 0.5, 1].map(v => (
                    <button key={v} onClick={() => set('buy_amount', v)}
                      className={clsx('cp-chip', form.buy_amount === v && 'cp-chip-active')}>{v}U</button>
                  ))}
                </div>
                <input type="number" step="0.01" min="0.01" value={form.buy_amount}
                  onChange={e => set('buy_amount', parseFloat(e.target.value) || 0.1)}
                  className="cp-input" />
              </div>

              {/* 止盈止损 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="cp-modal-label">{t('follow_modal.take_profit')}</label>
                  <input type="number" step="5" min="5" value={form.take_profit}
                    onChange={e => set('take_profit', parseFloat(e.target.value) || 50)}
                    className="cp-input" />
                </div>
                <div>
                  <label className="cp-modal-label">{t('follow_modal.stop_loss')}</label>
                  <input type="number" step="5" min="5" value={form.stop_loss}
                    onChange={e => set('stop_loss', parseFloat(e.target.value) || 30)}
                    className="cp-input" />
                </div>
              </div>

              {/* 最长持仓 */}
              <div>
                <label className="cp-modal-label">{t('follow_modal.max_hold')}</label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {[30, 60, 120, 240].map(v => (
                    <button key={v} onClick={() => set('max_hold_min', v)}
                      className={clsx('cp-chip', form.max_hold_min === v && 'cp-chip-active')}>
                      {t('follow_modal.minutes_unit', { n: v })}
                    </button>
                  ))}
                </div>
                <input type="number" step="10" min="10" value={form.max_hold_min}
                  onChange={e => set('max_hold_min', parseInt(e.target.value) || 60)}
                  className="cp-input" />
              </div>

              {/* 备注 */}
              <div>
                <label className="cp-modal-label">{t('follow_modal.note')}</label>
                <input type="text" value={form.note} placeholder={t('follow_modal.note_placeholder')}
                  onChange={e => set('note', e.target.value)}
                  className="cp-input" />
              </div>

              <div className="cp-modal-divider mt-1" />

              {/* 按钮 */}
              <div className="flex gap-2 pt-1">
                {exists && (
                  <button onClick={handleDelete} disabled={deleting}
                    className="cp-btn cp-btn-magenta px-4 py-2.5 text-sm font-mono font-bold tracking-wider uppercase border border-red-500/50 text-red-300">
                    {deleting ? t('follow_modal.deleting') : t('follow_modal.cancel_follow')}
                  </button>
                )}
                <button onClick={onClose}
                  className="cp-btn flex-1 py-2.5 text-sm font-mono font-bold tracking-wider uppercase border border-dark-500 text-gray-400 hover:text-gray-200">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="cp-btn flex-1 py-2.5 text-sm font-mono font-bold tracking-wider uppercase border border-accent-green/70 text-accent-green bg-accent-green/15 hover:bg-accent-green/25">
                  {saving ? t('follow_modal.saving') : (exists ? t('follow_modal.update_follow') : t('follow_modal.start_follow'))}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
