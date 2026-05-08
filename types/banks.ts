export interface ThailandBank {
  code: string
  name: string
  logo?: string
  color?: string
}

export const THAILAND_BANKS: readonly ThailandBank[] = [
  { code: "BBL", name: "Bangkok Bank", logo: "/banks/th/bbl.svg", color: "#1e4598" },
  { code: "KBANK", name: "Kasikornbank", logo: "/banks/th/kbank.svg", color: "#138f2d" },
  { code: "KTB", name: "Krung Thai Bank", logo: "/banks/th/ktb.svg", color: "#1ba5e1" },
  { code: "TTB", name: "TMBThanachart Bank", logo: "/banks/th/ttb.svg", color: "#fc4f1f" },
  { code: "SCB", name: "Siam Commercial Bank", logo: "/banks/th/scb.svg", color: "#4e2e7f" },
  { code: "CIMBT", name: "CIMB Thai Bank", logo: "/banks/th/cimb.svg", color: "#7e2f36" },
  { code: "UOBT", name: "United Overseas Bank (Thai)", logo: "/banks/th/uob.svg", color: "#0b3979" },
  { code: "BAY", name: "Bank of Ayudhya", logo: "/banks/th/bay.svg", color: "#fec43b" },
  { code: "GSB", name: "Government Savings Bank", logo: "/banks/th/gsb.svg", color: "#eb198d" },
  { code: "LHBANK", name: "Land and Houses Bank", logo: "/banks/th/lhb.svg", color: "#6d6e71" },
  { code: "KKP", name: "Kiatnakin Phatra Bank", logo: "/banks/th/kk.svg", color: "#199cc5" },
  { code: "TISCO", name: "TISCO Bank", logo: "/banks/th/tisco.svg", color: "#12549f" },
  { code: "BAAC", name: "Bank for Agriculture and Agricultural C.", logo: "/banks/th/baac.svg", color: "#4b9b1d" },
  { code: "CITI", name: "Citibank N.A", logo: "/banks/th/citi.svg", color: "#1583c7" },
  { code: "GHB", name: "Government Housing Bank", logo: "/banks/th/ghb.svg", color: "#f57d23" },
  { code: "ICBC", name: "Industrial and Commercial Bank", logo: "/banks/th/icbc.svg", color: "#c50f1c" },
  { code: "TCRB", name: "Thai Credit Bank Public Company Li.", logo: "/banks/th/tcrb.svg", color: "#0a4ab3" },
  { code: "SCBT", name: "Standard Chartered Bank (Thai)", logo: "/banks/th/sc.svg", color: "#0f6ea1" },
  { code: "HSBC", name: "Hongkong and Shanghai Banking", logo: "/banks/th/hsbc.svg", color: "#fd0d1b" },
  { code: "SMBC", name: "Sumitomo Mitsui Banking Corporati.", logo: "/banks/th/smbc.svg", color: "#a0d235" },
  { code: "MHCB", name: "Mizuho Corporate Bank", logo: "/banks/th/mufg.svg", color: "#150b78" },
  { code: "ISBT", name: "Islamic Bank of Thailand", logo: "/banks/th/ibank.svg", color: "#184615" },
  { code: "DBBK", name: "DEUTSCHE BANK AG, BANGKOK BR.", logo: "/banks/th/db.svg", color: "#0522a5" },
  { code: "BOC", name: "Bank of China (Thai) Public Company Li.", logo: "/banks/th/boa.svg", color: "#e11e3c" },
  { code: "IOBA", name: "INDIAN OVERSEAS BANK" },
  { code: "BNPP", name: "BNP PARIBAS, BANGKOK BRANCH", logo: "/banks/th/bnp.svg", color: "#14925e" },
  { code: "SME", name: "SMALL AND MEDIUM ENTERP." },
]

export type BankCode = (typeof THAILAND_BANKS)[number]["code"]
