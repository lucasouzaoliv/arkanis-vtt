import type { CSSProperties } from 'react'
import { ELEMENT_TEXTURE } from '../CharacterSheet/RitualCard'
import sangueIcon from '../../assets/rituais/sangue-simbolo.png'
import morteIcon from '../../assets/rituais/morte-simbolo.png'
import conhecimentoIcon from '../../assets/rituais/conhecimento-simbolo.png'
import energiaIcon from '../../assets/rituais/energia-simbolo.png'
import medoIcon from '../../assets/rituais/medo-simbolo.png'

// Ritual no chat (pedido da Millie, 11/10): o cartão ganha a textura do elemento bem clarinha por
// cima do branco e o símbolo do ritual do lado, pra quem lê saber de que elemento ele é.

export type RitualDaMensagem = { nome?: string | null; elemento?: string | null; imagem?: string | null }

const SIMBOLO_DO_ELEMENTO: Record<string, string> = {
  sangue: sangueIcon,
  morte: morteIcon,
  conhecimento: conhecimentoIcon,
  energia: energiaIcon,
  medo: medoIcon,
}

// Fundo: a textura do elemento quase toda coberta de branco (só um detalhe).
export function fundoDoRitual(elemento: string | null | undefined): CSSProperties | undefined {
  const textura = elemento ? ELEMENT_TEXTURE[elemento] : undefined
  if (!textura) return undefined
  return {
    backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.84)), url(${textura})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}

// O símbolo do ritual (ou o do elemento, se o ritual não tiver imagem) num quadradinho escuro
// com a textura do elemento: os símbolos são brancos e sumiriam no fundo claro do cartão.
export function SimboloDoRitual({ ritual }: { ritual: RitualDaMensagem }) {
  const imagem = ritual.imagem || (ritual.elemento ? SIMBOLO_DO_ELEMENTO[ritual.elemento] : undefined)
  if (!imagem) return null
  const textura = ritual.elemento ? ELEMENT_TEXTURE[ritual.elemento] : undefined
  return (
    <span className="chat-ritual-simbolo" style={textura ? { backgroundImage: `url(${textura})` } : undefined} title={ritual.nome ? `Ritual ${ritual.nome}${ritual.elemento ? ` (${ritual.elemento})` : ''}` : undefined}>
      <img src={imagem} alt="" />
    </span>
  )
}
