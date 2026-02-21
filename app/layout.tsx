import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const bananaGrotesk = localFont({
  src: [
    {
      path: "../public/brandbook/font/BANANAGROTESK-THIN.OTF",
      weight: "100",
      style: "normal",
    },
    {
      path: "../public/brandbook/font/BANANAGROTESK-EXTRALIGHT.OTF",
      weight: "200",
      style: "normal",
    },
    {
      path: "../public/brandbook/font/BANANAGROTESK-LIGHT.OTF",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/brandbook/font/BANANAGROTESK-REGULAR.OTF",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/brandbook/font/BANANAGROTESK-MEDIUM.OTF",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/brandbook/font/BANANAGROTESK-SEMIBOLD.OTF",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/brandbook/font/BANANAGROTESK-BOLD.OTF",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/brandbook/font/BANANAGROTESK-EXTRABOLD.OTF",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-banana",
});

export const metadata: Metadata = {
  title: "Tubular | Configurator",
  description: "Configure your USM Haller inspired furniture",
  icons: {
    icon: "/brandbook/favicon/favicon-con-fondo.png",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={bananaGrotesk.variable}>
      <body className="font-sans antialiased text-[#354763]">
        {children}
      </body>
    </html>
  );
}
