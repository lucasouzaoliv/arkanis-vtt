import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBookOpen,
  faMobileScreen,
  faGhost,
  faCircle,
  faHeadphones,
  faVolumeHigh,
  faDrawPolygon,
  faFont,
  faPalette,
  faSignature,
  faSquare,
  faTrash,
  faBullseye,
  faCaretRight,
  faComments,
  faExpand,
  faGears,
  faMap,
  faMoon,
  faMusic,
  faPencil,
  faPuzzlePiece,
  faRuler,
  faSuitcase,
  faUser,
} from '@fortawesome/free-solid-svg-icons'

// Espadas cruzadas do ícone de Encontros de Combate: o Foundry usa o "swords" do
// Font Awesome Pro, que não existe na versão gratuita, então vai desenhado aqui.
function Espadas() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden fill="currentColor">
      <path d="M3 2h4l9.2 9.2-2.8 2.8L4.2 4.8V2.9zM21 2h-4l-6.1 6.1 2.8 2.8L19.8 4.8V2.9z" />
      <path d="M6.4 14.3l3.3 3.3-1.6 1.6 1.4 1.4-1.4 1.4-2.1-2.1-2.4 2.4-1.4-1.4 2.4-2.4-2.1-2.1 1.4-1.4 1.4 1.4zM17.6 14.3l-3.3 3.3 1.6 1.6-1.4 1.4 1.4 1.4 2.1-2.1 2.4 2.4 1.4-1.4-2.4-2.4 2.1-2.1-1.4-1.4-1.4 1.4z" />
    </svg>
  )
}

const fa = (icone: Parameters<typeof FontAwesomeIcon>[0]['icon']) => <FontAwesomeIcon icon={icone} />

export const ICONES: Record<string, ReactNode> = {
  chat: fa(faComments),
  combate: <Espadas />,
  cenas: fa(faMap),
  posicionaveis: fa(faPuzzlePiece),
  personagens: fa(faUser),
  itens: fa(faSuitcase),
  diario: fa(faBookOpen),
  playlist: fa(faMusic),
  config: fa(faGears),
  recolher: fa(faCaretRight),
  celular: fa(faMobileScreen),
  sustos: fa(faGhost),
  // Barra esquerda: categorias e ferramentas
  tokens: fa(faUser),
  desenho: fa(faPencil),
  som: fa(faMusic),
  selecionar: fa(faExpand),
  alvos: fa(faBullseye),
  medir: fa(faRuler),
  'desenho-selecionar': fa(faExpand),
  retangulo: fa(faSquare),
  elipse: fa(faCircle),
  poligono: fa(faDrawPolygon),
  livre: fa(faSignature),
  texto: fa(faFont),
  paleta: fa(faPalette),
  'limpar-desenhos': fa(faTrash),
  'som-selecionar': fa(faExpand),
  'som-desenhar': fa(faVolumeHigh),
  'som-previsualizar': fa(faHeadphones),
  'som-paleta': fa(faPalette),
  'som-limpar': fa(faTrash),
  escuridao: fa(faMoon),
  'escuridao-selecionar': fa(faExpand),
  'escuridao-desenhar': fa(faSquare),
  'escuridao-limpar': fa(faTrash),
}
