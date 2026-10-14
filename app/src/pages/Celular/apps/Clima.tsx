// Clima: o tempo do dia no relógio do jogo (o mesmo clima que o mestre escolhe no calendário), e os
// próximos dias.
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCloud, faCloudBolt, faCloudRain, faSmog, faSnowflake, faSun, faTemperatureHigh, faWind, faMoon } from '@fortawesome/free-solid-svg-icons'
import { CLIMAS, climaDoDia, comAgora, dataDoDia, diasDaSemana, diaDaSemana, momento, periodo, tempoAtivo, tempoCompleto, type Clima } from '../../Mesa/tempo'
import { useCelular } from '../estado'
import { texto } from '../textos'

const ICONE: Record<Clima, typeof faSun> = {
  limpo: faSun, nublado: faCloud, chuva: faCloudRain, tempestade: faCloudBolt, neblina: faSmog, neve: faSnowflake, vento: faWind, calor: faTemperatureHigh,
}
const FUNDO: Record<Clima, string> = {
  limpo: 'linear-gradient(180deg, #3a8ee6, #6fb7ff)', nublado: 'linear-gradient(180deg, #6b7a8f, #9aa7b8)', chuva: 'linear-gradient(180deg, #3e4b5e, #66768c)',
  tempestade: 'linear-gradient(180deg, #23283a, #47506a)', neblina: 'linear-gradient(180deg, #8b9098, #b9bdc4)', neve: 'linear-gradient(180deg, #9fb7d6, #dbe7f5)',
  vento: 'linear-gradient(180deg, #5c7d93, #8fb1c4)', calor: 'linear-gradient(180deg, #e8742c, #f7b046)',
}
// Temperatura de enfeite pro clima (o calendário não guarda graus).
const GRAUS: Record<Clima, number> = { limpo: 27, nublado: 22, chuva: 19, tempestade: 17, neblina: 15, neve: -2, vento: 18, calor: 36 }

export default function AppClima() {
  const e = useCelular()
  const idioma = e.celular.idioma
  if (!e.tempo || !tempoAtivo(e.tempo)) {
    return <div className="cel-clima" style={{ background: FUNDO.nublado }}><p className="cel-clima-aviso">{texto(idioma, 'semLocalizacao')}</p></div>
  }
  const t = comAgora(tempoCompleto(e.tempo))
  const m = momento(t)
  const hoje = climaDoDia(t, m.dia)
  const noite = periodo(t, m) === 'noite'
  const proximos = [1, 2, 3, 4, 5].map((n) => {
    const c = climaDoDia(t, m.dia + n)
    return { n, c, dia: diasDaSemana(t)[diaDaSemana(t, dataDoDia(t, m.dia + n))]?.slice(0, 3) ?? `+${n}` }
  })
  return (
    <div className="cel-clima" style={{ background: noite ? 'linear-gradient(180deg, #0d1530, #2a3a66)' : FUNDO[hoje] }}>
      <p className="cel-clima-lugar">{e.celular.nome_no_perfil ? 'Localização atual' : ''}</p>
      <p className="cel-clima-graus">{GRAUS[hoje]}°</p>
      <p className="cel-clima-nome"><FontAwesomeIcon icon={noite && hoje === 'limpo' ? faMoon : ICONE[hoje]} /> {CLIMAS.find((c) => c.id === hoje)?.rotulo}</p>
      <div className="cel-clima-dias">
        {proximos.map((p) => (
          <div key={p.n}><span>{p.dia}</span><FontAwesomeIcon icon={ICONE[p.c]} /><b>{GRAUS[p.c]}°</b></div>
        ))}
      </div>
    </div>
  )
}
