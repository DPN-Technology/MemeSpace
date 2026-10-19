import type {Metadata,Viewport} from 'next';
import './globals.css';
import './arcade/arcade.css';
import './modern.css';
export const viewport:Viewport={themeColor:'#05060a',colorScheme:'dark'};
export const metadata:Metadata={title:'MemeSpace — Enter the Mind',description:'Enter a living digital mind. Explore meme culture, history, games and community through the MemeSpace neural universe.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="dark"><body>{children}</body></html>}
