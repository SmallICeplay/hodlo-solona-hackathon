import { useTranslation } from 'react-i18next'
import WalletPanel from './WalletPanel'

export default function WalletModal({ onClose }) {
  const { t } = useTranslation()
  return (
    <div
      className="cp-modal-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="web3-frame cp-cfg-wallet-modal"
        onClick={e => e.stopPropagation()}
      >
        <span className="w3-corners" aria-hidden="true"><i></i></span>
        <div className="web3-frame-inner cp-modal-bg flex flex-col" style={{ maxHeight: 'inherit' }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
            <h3 className="cp-modal-title">{t('wallet.modal_title')}</h3>
            <button
              onClick={onClose}
              className="cp-modal-close shrink-0"
              aria-label={t('common.close')}
            >×</button>
          </div>
          <div className="cp-modal-divider" />
          <div className="cp-cfg-wallet-modal-body pt-4">
            <WalletPanel logs={[]} />
          </div>
        </div>
      </div>
    </div>
  )
}
