import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getWalletStatus, createWallet, importWallet, deleteWallet, sweepResidualTokens } from '../api'
import { Card } from './UI'
import { clsx } from 'clsx'

const CHAIN_PILL = { SOL: 'cp-pill-blue', BSC: 'cp-pill-yellow', ETH: 'cp-pill-blue', XLAYER: 'cp-pill-gray' }

export default function WalletPanel({ logs = [] }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState(null)
  const [mode, setMode] = useState(null)
  const [mnemonicInput, setMnemonicInput] = useState('')
  const [newWalletResult, setNewWalletResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const load = async () => {
    try { setStatus(await getWalletStatus()) }
    catch { setStatus({ exists: false, addresses: {} }) }
  }
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    setLoading(true); setError('')
    try { const r = await createWallet(); setNewWalletResult(r); setMode(null); await load() }
    catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }

  const handleImport = async () => {
    if (!mnemonicInput.trim()) return
    setLoading(true); setError('')
    try { await importWallet(mnemonicInput.trim()); setMnemonicInput(''); setMode(null); await load() }
    catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!confirm(t('wallet.delete_confirm'))) return
    setLoading(true)
    try { await deleteWallet(); setNewWalletResult(null); setConfirmed(false); await load() }
    catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }

  if (!status) return (
    <Card className="cp-cfg-card">
      <div className="text-center text-gray-400 py-8 font-mono text-sm">{t('common.loading')}</div>
    </Card>
  )

  return (
    <div className="space-y-4">
      {/* 新建钱包后显示助记词 */}
      {newWalletResult && (
        <Card className="cp-cfg-card !border-accent-yellow/50 !bg-accent-yellow/5">
          <div className="flex items-start gap-3 mb-4">
            <div>
              <p className="cp-modal-label !text-accent-yellow !mb-1">{t('wallet.backup_warn_title')}</p>
              <p className="cp-hint">{t('wallet.backup_warn_subtitle')}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {newWalletResult.mnemonic?.split(' ').map((word, i) => (
              <div key={i} className="cp-chip !text-sm !py-2 text-center">
                <span className="text-gray-500 text-xs">{i + 1}.</span>
                <span className="text-white ml-1 font-mono">{word}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => setConfirmed(v => !v)}
              className={clsx('cp-checkbox shrink-0', confirmed && 'cp-checkbox-on')}
            >
              {confirmed && <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            <label onClick={() => setConfirmed(v => !v)} className="cp-filter-label cursor-pointer">
              {t('wallet.backup_confirm_label')}
            </label>
          </div>
          <button
            disabled={!confirmed}
            onClick={() => setNewWalletResult(null)}
            className={clsx('cp-cfg-btn cp-cfg-btn-primary', !confirmed && 'opacity-40 cursor-not-allowed')}
          >
            {t('wallet.backup_confirm_btn')}
          </button>
        </Card>
      )}

      {/* 钱包状态 */}
      <Card className="cp-cfg-card">
        <div className="flex items-center justify-between mb-4">
          <p className="cp-modal-label !mb-0">{t('wallet.status_title')}</p>
          {status.exists && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="cp-cfg-btn cp-cfg-btn-ghost !border-accent-red/50 !text-accent-red hover:!border-accent-red hover:!bg-accent-red/10 disabled:opacity-40"
            >
              {t('wallet.delete_btn')}
            </button>
          )}
        </div>

        {status.exists ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-mono font-semibold text-accent-green">
              <div className="w-2 h-2 bg-accent-green rounded-full bot-glow" />
              {t('wallet.configured_note')}
            </div>
            <div className="space-y-2 mt-3">
              {Object.entries(status.addresses || {}).map(([chain, addr]) => (
                <div key={chain} className="cp-stat-panel !p-3 flex items-center gap-3">
                  <span className={clsx('cp-pill shrink-0', CHAIN_PILL[chain] || 'cp-pill-gray')}>{chain}</span>
                  <span className="font-mono text-sm text-gray-200 break-all flex-1">{addr}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(addr)}
                    className="cp-cfg-btn cp-cfg-btn-ghost !py-1 !px-3 !text-[11px] shrink-0"
                    title={t('wallet.copy_addr_tooltip')}
                  >
                    {t('common.copy')}
                  </button>
                </div>
              ))}
            </div>
            <p className="cp-hint">{t('wallet.pk_note')}</p>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="cp-hint text-center mb-5">{t('wallet.not_configured')}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setMode('create'); setError('') }} className="cp-cfg-btn cp-cfg-btn-primary">
                {t('wallet.create_btn')}
              </button>
              <button onClick={() => { setMode('import'); setError('') }} className="cp-cfg-btn cp-cfg-btn-ghost">
                {t('wallet.import_btn')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 新建确认 */}
      {mode === 'create' && (
        <Card className="cp-cfg-card !border-accent-blue/30">
          <p className="cp-modal-label !mb-2">{t('wallet.create_btn')}</p>
          <p className="cp-hint mb-4">{t('wallet.create_form_desc')}</p>
          <p className="cp-hint !border-accent-yellow/50 !text-accent-yellow mb-4">{t('wallet.create_form_warn')}</p>
          {error && <p className="text-sm font-mono text-accent-red mb-3">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={loading} className="cp-cfg-btn cp-cfg-btn-primary disabled:opacity-40">
              {loading ? t('wallet.create_loading') : t('wallet.create_confirm')}
            </button>
            <button onClick={() => setMode(null)} className="cp-cfg-btn cp-cfg-btn-ghost">{t('common.cancel')}</button>
          </div>
        </Card>
      )}

      {/* 导入助记词 */}
      {mode === 'import' && (
        <Card className="cp-cfg-card !border-accent-blue/30">
          <p className="cp-modal-label !mb-2">{t('wallet.import_btn')}</p>
          <p className="cp-hint mb-3">{t('wallet.import_form_desc')}</p>
          <textarea
            value={mnemonicInput}
            onChange={e => setMnemonicInput(e.target.value)}
            placeholder="word1 word2 word3 ... word12"
            rows={3}
            className="cp-input resize-none mb-3"
          />
          {error && <p className="text-sm font-mono text-accent-red mb-3">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={loading || !mnemonicInput.trim()}
              className="cp-cfg-btn cp-cfg-btn-primary disabled:opacity-40"
            >
              {loading ? t('wallet.import_loading') : t('wallet.import_confirm')}
            </button>
            <button onClick={() => { setMode(null); setMnemonicInput('') }} className="cp-cfg-btn cp-cfg-btn-ghost">
              {t('common.cancel')}
            </button>
          </div>
        </Card>
      )}

      {/* 残留代币扫描 */}
      <SweepPanel logs={logs} />

      {/* 安全说明 */}
      <Card className="cp-cfg-card">
        <div className="cp-section-label mb-3">{t('wallet.security_title')}</div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <p key={i} className="cp-hint">{t(`wallet.security_item_${i}`)}</p>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SweepPanel({ logs = [] }) {
  const { t } = useTranslation()
  const [state, setState] = useState('idle')
  const [errMsg, setErrMsg] = useState('')
  const [startedAt, setStartedAt] = useState(null)
  const logEndRef = useRef(null)

  const sweepLogs = logs.filter(log => {
    if (log.type !== 'log' && !log.data?.message) return false
    const msg = log.data?.message || ''
    return msg.includes('🔍') || msg.includes('💰') || (startedAt && log.ts >= startedAt)
      ? (msg.includes('🔍') || msg.includes('💰') || msg.includes('✅ 卖出') || msg.includes('❌ 卖出'))
      : false
  })

  const isDone = sweepLogs.some(l => (l.data?.message || '').includes('扫描完成'))
  useEffect(() => { if (isDone && state === 'started') { setState('idle'); setStartedAt(null) } }, [isDone])
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [sweepLogs.length])

  const handleSweep = async () => {
    if (!window.confirm(t('sweep.confirm'))) return
    setState('started'); setStartedAt(Date.now()); setErrMsg('')
    try { await sweepResidualTokens() }
    catch (e) { setErrMsg(e.response?.data?.detail || e.message || t('sweep.request_failed')); setState('error') }
  }

  const LEVEL_COLOR = { info: 'text-gray-300', warn: 'text-accent-yellow', error: 'text-accent-red' }

  return (
    <Card className="cp-cfg-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="cp-modal-label !mb-1">{t('sweep.title')}</p>
          <p className="cp-hint">{t('sweep.desc')}</p>
        </div>
        <button
          onClick={handleSweep}
          disabled={state === 'started'}
          className={clsx(
            'cp-cfg-btn shrink-0',
            state === 'started'
              ? 'cp-cfg-btn-ghost opacity-40 cursor-not-allowed'
              : 'cp-cfg-btn-ghost !border-accent-yellow/50 !text-accent-yellow hover:!border-accent-yellow hover:!bg-accent-yellow/10'
          )}
        >
          {state === 'started' ? t('sweep.scanning') : t('sweep.start_btn')}
        </button>
      </div>

      {state === 'error' && <p className="text-sm font-mono text-accent-red mb-2">{errMsg}</p>}

      {sweepLogs.length > 0 && (
        <div className="cp-expanded p-3 max-h-48 overflow-y-auto font-mono space-y-0.5 mt-2">
          {[...sweepLogs].reverse().map(log => (
            <div key={log.id} className={clsx('text-xs leading-relaxed', LEVEL_COLOR[log.level] || 'text-gray-400')}>
              {log.data?.message || ''}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {state === 'started' && sweepLogs.length === 0 && (
        <p className="text-sm font-mono text-accent-yellow/80 animate-pulse mt-1">{t('sweep.waiting')}</p>
      )}
    </Card>
  )
}
