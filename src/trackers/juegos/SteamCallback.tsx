import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { verifySteamLogin } from '../../lib/steam'
import { PageContainer } from '../../components/PageContainer'
import { gamesPaths } from './paths'

export function SteamCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'ok' | 'warn' | 'error'>('loading')
  const [message, setMessage] = useState('Verificando con Steam...')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const search = window.location.search
    if (!search.includes('openid')) {
      navigate(gamesPaths.steamImport, { replace: true })
      return
    }

    verifySteamLogin(search)
      .then((profile) => {
        if (profile.is_public === false) {
          setStatus('warn')
          setMessage(
            'Cuenta vinculada, pero tu perfil de Steam parece estar en privado. ' +
              'Cámbialo a público para poder importar tu biblioteca.'
          )
        } else {
          setStatus('ok')
          setMessage('Cuenta de Steam vinculada.')
        }
        setTimeout(() => navigate(gamesPaths.steamImport, { replace: true }), 1800)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'No se pudo vincular la cuenta de Steam.')
      })
  }, [navigate])

  const color =
    status === 'error'
      ? 'text-error'
      : status === 'warn'
        ? 'text-warning'
        : 'text-lavender'

  return (
    <PageContainer>
      <div className="mx-auto mt-16 max-w-sm text-center">
        <p className={`text-sm ${color}`}>{message}</p>
        {status === 'error' && (
          <button
            onClick={() => navigate(gamesPaths.steamImport, { replace: true })}
            className="mt-4 text-sm text-accent"
          >
            Volver
          </button>
        )}
      </div>
    </PageContainer>
  )
}
