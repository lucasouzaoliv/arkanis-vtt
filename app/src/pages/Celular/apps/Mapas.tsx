// Mapas: por enquanto só a cara do app (o GPS de verdade, com os pontos que o mestre marca, entra
// numa próxima parte). Sem sinal, nem isso.
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationCrosshairs, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { useCelular } from '../estado'
import { texto } from '../textos'

export default function AppMapas() {
  const e = useCelular()
  const idioma = e.celular.idioma
  return (
    <div className="cel-mapas">
      <div className="cel-mapas-fundo" />
      <label className="cel-busca cel-mapas-busca">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <input placeholder={texto(idioma, 'buscar')} />
      </label>
      <div className="cel-mapas-aviso">
        <FontAwesomeIcon icon={faLocationCrosshairs} />
        <p>{e.celular.efeitos.sem_sinal ? texto(idioma, 'semServico') : texto(idioma, 'semLocalizacao')}</p>
      </div>
    </div>
  )
}
