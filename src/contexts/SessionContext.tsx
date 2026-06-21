import { createContext, useContext } from 'react'

interface SessionContextType {
  inSession: boolean
  setInSession: (v: boolean) => void
}

const SessionContext = createContext<SessionContextType>({
  inSession: false,
  setInSession: () => {},
})

export default SessionContext

export function useSessionContext() {
  return useContext(SessionContext)
}
