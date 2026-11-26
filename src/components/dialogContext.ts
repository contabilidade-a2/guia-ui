import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  /** Text of the button that goes ahead (default "Confirmar"). */
  confirmLabel?: string
  /** Red button: deleting, removing. */
  danger?: boolean
}

export interface PromptOptions extends ConfirmOptions {
  /** Label of the text box. */
  label: string
}

export interface Dialogs {
  /** The system's own confirmation window, instead of the browser's: resolves true to go ahead. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /** Asks for a text (required); resolves null when cancelled. */
  prompt: (options: PromptOptions) => Promise<string | null>
}

export const DialogContext = createContext<Dialogs | null>(null)

export function useDialogs(): Dialogs {
  const dialogs = useContext(DialogContext)
  if (!dialogs) throw new Error('useDialogs fora do DialogProvider')
  return dialogs
}
