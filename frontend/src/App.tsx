import BackgroundScene from '@/components/ui/aurora-section-hero'
import { Button } from '@/components/ui/button'

function App() {
  return (
    <div className="relative min-h-screen flex flex-col font-sans text-white overflow-hidden bg-black">
      <BackgroundScene beamCount={60} />

      {/* Header / Navbar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-sm border-b border-green-500/10">
        <div className="flex items-center gap-3">
          {/* O logo será lido da pasta public */}
          <img src="/logo.png" alt="Marco Despachante Logo" className="h-10 w-auto object-contain brightness-0 invert" />
          <span className="font-semibold tracking-wide text-lg text-green-100">
            Marco Despachante
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-green-200">
          <a href="#" className="hover:text-green-400 transition-colors">Recursos</a>
          <a href="#" className="hover:text-green-400 transition-colors">A IA</a>
          <a href="#" className="hover:text-green-400 transition-colors">Planos</a>
        </nav>
      </header>

      {/* Main Hero Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center mt-[-4rem]">
        
        {/* Badge / Pill */}
        <div className="mb-6 inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-sm text-green-300 shadow-inner backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
          Inteligência Artificial para Recursos
        </div>

        <h1 className="max-w-4xl text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-green-300 drop-shadow-sm mb-6 pb-2">
          Bem vindo ao futuro com o Marco Despachante
        </h1>
        
        <p className="max-w-2xl text-lg md:text-xl text-green-100/80 mb-10 leading-relaxed font-light">
          A Inteligência Artificial que acelera e automatiza seus recursos de multas de trânsito em segundos.
        </p>
        
        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <a href="/chat.html" className="group">
            <Button size="lg" className="h-14 px-8 text-base font-semibold bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all rounded-xl border border-green-400/50">
              Acesse o Sistema
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 group-hover:translate-x-1 transition-transform"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </Button>
          </a>
          
          <Button variant="outline" size="lg" className="h-14 px-8 text-base font-medium border-green-500/30 text-green-300 hover:bg-green-500/10 hover:text-green-200 transition-colors rounded-xl bg-transparent">
            Saiba Mais
          </Button>
        </div>
      </main>

    </div>
  )
}

export default App
