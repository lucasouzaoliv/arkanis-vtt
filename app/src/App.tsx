import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './lib/ProtectedRoute'
import Navbar from './components/Navbar'
import AvisoErroBanco from './components/AvisoErroBanco'
import AvisoVersaoNova from './components/AvisoVersaoNova'
import Home from './pages/Home'
import Login from './pages/Login'
import Perfil from './pages/Perfil'
import EditarPerfil from './pages/EditarPerfil'
import Jogar from './pages/Jogar'
import SystemSelect from './pages/SystemSelect'
import CharacterCreate from './pages/CharacterCreate'
import CriarFichaOP2 from './pages/CriarFichaOP2'
import CharacterSheet from './pages/CharacterSheet'
import EntrarCampanha from './pages/EntrarCampanha'
import Mesa from './pages/Mesa'
import CriarCampanha from './pages/CriarCampanha'
import PedidosDeAcesso from './pages/PedidosDeAcesso'
import { ligarSonsDoSite } from './lib/sons'

// Sons do site todo: abrir/fechar janelinhas, clique em botão e caixinhas (lib/sons.ts).
ligarSonsDoSite()

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
          <Route path="/acessos" element={<ProtectedRoute><PedidosDeAcesso /></ProtectedRoute>} />
          <Route path="/perfil/editar" element={<ProtectedRoute><EditarPerfil /></ProtectedRoute>} />
          <Route path="/jogar" element={<ProtectedRoute><Jogar /></ProtectedRoute>} />
          <Route path="/campanha/criar" element={<ProtectedRoute><CriarCampanha /></ProtectedRoute>} />
          <Route path="/campanha/:id/editar" element={<ProtectedRoute><CriarCampanha key="editar" /></ProtectedRoute>} />
          <Route path="/campanha/entrar/:code" element={<ProtectedRoute><EntrarCampanha /></ProtectedRoute>} />
          <Route path="/mesa/:id" element={<ProtectedRoute><Mesa /></ProtectedRoute>} />
          <Route path="/personagem/criar" element={<ProtectedRoute><SystemSelect /></ProtectedRoute>} />
          <Route path="/personagem/criar/ordem-paranormal-2" element={<ProtectedRoute><CriarFichaOP2 /></ProtectedRoute>} />
          <Route path="/personagem/criar/:system" element={<ProtectedRoute><CharacterCreate /></ProtectedRoute>} />
          <Route path="/personagem/:id" element={<ProtectedRoute><CharacterSheet /></ProtectedRoute>} />
        </Routes>
        <AvisoErroBanco />
        <AvisoVersaoNova />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
