import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faAppStoreIos, faDiscord, faGooglePlay, faInstagram, faSpotify, faTiktok, faUber, faWhatsapp, faXTwitter, faYoutube } from '@fortawesome/free-brands-svg-icons'
import {
  faBuildingColumns, faCalculator, faCamera, faCloudSun, faEnvelope, faGamepad, faGear, faImages, faMapLocationDot, faMusic, faNewspaper,
  faNoteSticky, faPhone,
} from '@fortawesome/free-solid-svg-icons'
import { Brasao } from './Brasao'
import type { Modelo } from './dados'

// Cara de cada app na tela inicial (referências da Millie: iPhone e Samsung estilo FiveM).
// Os de marca usam o logo de verdade (liberado por ela, 14/10); o fundo imita o app.
type Visual = { icone?: IconDefinition; brasao?: boolean; fundo: string; cor?: string }

const VISUAL: Record<string, Visual> = {
  telefone: { icone: faPhone, fundo: 'linear-gradient(180deg, #5df777 0%, #1fc23f 100%)' },
  mensagens: { icone: faWhatsapp, fundo: 'linear-gradient(180deg, #5ef08a 0%, #1fae4f 100%)' },
  configuracoes: { icone: faGear, fundo: 'linear-gradient(180deg, #b9bcc4 0%, #6f737d 100%)' },
  mapas: { icone: faMapLocationDot, fundo: 'linear-gradient(135deg, #7ee0a4 0%, #4aa3ff 60%, #f6f6f6 100%)' },
  ordem: { brasao: true, fundo: 'radial-gradient(circle at 50% 35%, #0f3a1f 0%, #070b09 75%)' },
  galeria: { icone: faImages, fundo: 'linear-gradient(135deg, #ffd166 0%, #ef476f 50%, #7b5cff 100%)' },
  camera: { icone: faCamera, fundo: 'linear-gradient(180deg, #d9dbe0 0%, #8b8f99 100%)', cor: '#1d1f24' },
  notas: { icone: faNoteSticky, fundo: 'linear-gradient(180deg, #ffe680 0%, #f7c948 100%)', cor: '#5b4a10' },
  noticias: { icone: faNewspaper, fundo: 'linear-gradient(180deg, #ff6b6b 0%, #d62839 100%)' },
  rede_social: { icone: faInstagram, fundo: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)' },
  email: { icone: faEnvelope, fundo: 'linear-gradient(180deg, #5aa9ff 0%, #1d6fe0 100%)' },
  spotify: { icone: faSpotify, fundo: '#121212', cor: '#1ed760' },
  uber: { icone: faUber, fundo: '#000' },
  twitter: { icone: faXTwitter, fundo: '#000' },
  tiktok: { icone: faTiktok, fundo: '#000' },
  youtube: { icone: faYoutube, fundo: '#fff', cor: '#ff0000' },
  discord: { icone: faDiscord, fundo: '#5865f2' },
  calculadora: { icone: faCalculator, fundo: 'linear-gradient(180deg, #8bd450 0%, #4f9a1f 100%)' },
  banco: { icone: faBuildingColumns, fundo: 'linear-gradient(180deg, #a35cff 0%, #6a1fd1 100%)' },
  musica: { icone: faMusic, fundo: 'linear-gradient(180deg, #ff6f91 0%, #e2264d 100%)' },
  clima: { icone: faCloudSun, fundo: 'linear-gradient(180deg, #6ec3ff 0%, #2f7de1 100%)' },
  jogo: { icone: faGamepad, fundo: 'linear-gradient(180deg, #ff9f43 0%, #ee5a24 100%)' },
}

function visualDaLoja(modelo: Modelo): Visual {
  return modelo === 'iphone'
    ? { icone: faAppStoreIos, fundo: 'linear-gradient(180deg, #1ec8ff 0%, #1673f0 100%)' }
    : { icone: faGooglePlay, fundo: '#fff', cor: '#01875f' }
}

export function IconeDoApp({ id, modelo, tamanho = 52 }: { id: string; modelo: Modelo; tamanho?: number }) {
  const v = id === 'loja' ? visualDaLoja(modelo) : VISUAL[id] ?? { icone: faGear, fundo: '#555' }
  return (
    <span
      className={`cel-icone cel-icone-${modelo}`}
      style={{ width: tamanho, height: tamanho, background: v.fundo, color: v.cor ?? '#fff', fontSize: tamanho * 0.52 }}
      aria-hidden
    >
      {v.brasao ? <Brasao tamanho={tamanho * 0.62} /> : v.icone && <FontAwesomeIcon icon={v.icone} />}
    </span>
  )
}
