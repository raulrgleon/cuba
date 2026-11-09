import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://cuba.dnet.llc'),
  title: 'CubaOS · Observatorio geográfico de Cuba',
  description: 'Explora provincias, municipios y series demográficas de Cuba con datos abiertos y fuentes verificables.',
  alternates: {canonical:'/'},
  openGraph: {type:'website', title:'CubaOS · Observatorio geográfico', url:'https://cuba.dnet.llc'},
  icons: {icon:'/cubaos.svg'},
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="es"><body>{children}</body></html>;
}
