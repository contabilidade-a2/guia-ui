import { useCallback, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { DialogContext } from './dialogContext'
import type { ConfirmOptions, Dialogs, PromptOptions } from './dialogContext'
import { Modal } from './ui'

type Open =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void }

/** Renders the confirmation and text windows in the system's layout (the same as the other modals). */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  const [text, setText] = useState('')

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setOpen({ kind: 'confirm', options, resolve })),
    [],
  )
  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setText('')
        setOpen({ kind: 'prompt', options, resolve })
      }),
    [],
  )
  const dialogs = useMemo<Dialogs>(() => ({ confirm, prompt }), [confirm, prompt])

  const close = useCallback(() => {
    setOpen((current) => {
      if (current?.kind === 'confirm') current.resolve(false)
      else current?.resolve(null)
      return null
    })
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!open) return
    if (open.kind === 'confirm') open.resolve(true)
    else {
      if (!text.trim()) return
      open.resolve(text.trim())
    }
    setOpen(null)
  }

  const options = open?.options
  return (
    <DialogContext.Provider value={dialogs}>
      {children}
      {open && options && (
        <Modal title={options.title} onClose={close}>
          <form className="dialog" onSubmit={submit}>
            {options.message && <p className="dialog-message">{options.message}</p>}
            {open.kind === 'prompt' && (
              <label className="field">
                <span className="field-label">{open.options.label}</span>
                <textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} autoFocus />
              </label>
            )}
            <div className="form-actions">
              <button type="button" className="button" onClick={close}>
                Cancelar
              </button>
              <button
                type="submit"
                className={`button ${options.danger ? 'button-danger' : 'button-primary'}`}
                disabled={open.kind === 'prompt' && !text.trim()}
                autoFocus={open.kind === 'confirm'}
              >
                {options.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </DialogContext.Provider>
  )
}
