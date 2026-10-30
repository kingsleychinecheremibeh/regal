export type IconName =
  | "trade"
  | "pay"
  | "globe"
  | "card"
  | "wealth"
  | "shield"
  | "code"
  | "book"
  | "swap"
  | "store"
  | "home"
  | "chart";

export type SitePage = {
  title: string;
  icon: IconName;
  lead: string;
  features: [string, string][];
  steps: string[];
  form?: string;
  legal?: [string, string][];
  cta?: boolean;
};

export const pages: Record<string, SitePage> = {
  "buy-sell": {
    title: "Buy and sell digital assets",
    icon: "trade",
    lead: "Buy and sell supported digital assets from your TurboXGlobal account. You see the price, the fee and the total before you confirm.",
    features: [
      [
        "Clear pricing",
        "The fee and the final amount are shown on the order screen before you confirm anything.",
      ],
      [
        "Market and limit orders",
        "Trade at the current price, or set the price you want and let the order wait.",
      ],
      [
        "Search and watchlist",
        "Find assets quickly and keep the ones you follow in one place.",
      ],
      [
        "Complete history",
        "Every order is saved in your account with its status and reference.",
      ],
    ],
    steps: [
      "Create your account and verify your profile.",
      "Fund your account.",
      "Pick an asset, enter an amount and confirm.",
    ],
    cta: true,
  },
  swap: {
    title: "Swap coins",
    icon: "swap",
    lead: "Exchange one supported digital asset for another in a single step. The rate and fee are shown before you confirm.",
    features: [
      ["One step", "Choose what you hold, choose what you want, and confirm."],
      [
        "Rate and fee up front",
        "See exactly what you will receive before you commit.",
      ],
      ["Instant record", "Each swap appears in your transaction history."],
    ],
    steps: [
      "Choose the asset to swap from.",
      "Choose the asset you want.",
      "Review the rate and fee, then confirm.",
    ],
    cta: true,
  },
  markets: {
    title: "Market overview",
    icon: "chart",
    lead: "Follow supported digital assets in one view: price, 24-hour change and charts, with a watchlist for the assets you care about.",
    features: [
      ["Charts", "Switch between time ranges to see how an asset has moved."],
      ["Watchlist", "Star an asset to keep it on your dashboard."],
      [
        "Straight to trading",
        "Open a buy, sell or swap ticket from any asset.",
      ],
    ],
    steps: [
      "Open TradeHUB in your dashboard.",
      "Search for an asset.",
      "Add it to your watchlist or start a trade.",
    ],
    cta: true,
  },
  turboxpay: {
    title: "TurboXPay",
    icon: "pay",
    lead: "TurboXPay is how you move money on TurboXGlobal: send to saved beneficiaries, pay bills, and keep a receipt for every payment.",
    features: [
      [
        "Saved beneficiaries",
        "Add someone once and pay them again in seconds.",
      ],
      [
        "Fees before you pay",
        "The fee and any exchange rate are shown on the review screen.",
      ],
      [
        "Receipts and references",
        "Each payment has a reference you can quote to support.",
      ],
      [
        "Status you can follow",
        "See whether a payment is pending, completed or failed, and why.",
      ],
    ],
    steps: [
      "Choose a beneficiary or biller.",
      "Enter the amount and review the fee.",
      "Confirm and follow the status.",
    ],
    cta: true,
  },
  bills: {
    title: "Bills and utilities",
    icon: "pay",
    lead: "Pay your bills from your TurboXGlobal balance without leaving the app. Every payment comes with a receipt.",
    features: [
      ["Pay from your balance", "Use the currency you already hold."],
      ["Receipts", "Download or share proof of payment whenever you need it."],
      [
        "Clear failures",
        "If a payment fails, you see the reason and what to do next.",
      ],
    ],
    steps: [
      "Choose a biller.",
      "Enter the account details and amount.",
      "Confirm and keep your receipt.",
    ],
    cta: true,
  },
  transfers: {
    title: "International transfers",
    icon: "globe",
    lead: "Send money to people and businesses in other countries. You see the fee, the exchange rate and what the recipient gets before you send.",
    features: [
      ["Transparent costs", "Fee and rate shown before you confirm."],
      ["Trackable", "Follow each transfer from sent to received."],
      ["Saved recipients", "Reuse beneficiary details safely."],
    ],
    steps: [
      "Add your recipient.",
      "Enter the amount and review.",
      "Send and track.",
    ],
    cta: true,
  },
  convert: {
    title: "Currency conversion",
    icon: "swap",
    lead: "Convert between your USD, EUR and GBP balances in a few taps, with the rate and fee shown before you confirm.",
    features: [
      [
        "Between your balances",
        "Move value from one currency to another instantly.",
      ],
      ["Rate shown first", "No surprises after you confirm."],
      [
        "Recorded in history",
        "Every conversion is listed in your transactions.",
      ],
    ],
    steps: [
      "Choose the currencies.",
      "Enter the amount.",
      "Review and convert.",
    ],
    cta: true,
  },
  merchant: {
    title: "Merchant payments",
    icon: "store",
    lead: "Accept payments from customers online with a business account: cards, wallets and local bank transfers through one integration.",
    features: [
      ["One integration", "Connect once and accept several payment methods."],
      [
        "Payment status tracking",
        "See each payment from initiation to settlement.",
      ],
      [
        "Reconciliation",
        "Match payments to your own records with clear references.",
      ],
      ["Webhooks", "Get notified when a payment changes status."],
    ],
    steps: [
      "Open a business account.",
      "Complete business verification.",
      "Integrate and start accepting payments.",
    ],
    cta: true,
  },
  "global-accounts": {
    title: "Global accounts",
    icon: "globe",
    lead: "Hold and manage USD, EUR and GBP in one place. Receive payments, send transfers and convert between currencies.",
    features: [
      ["USD, EUR and GBP", "Three major currencies in one account."],
      [
        "Incoming and outgoing history",
        "See every movement with dates and references.",
      ],
      ["Statements", "Download statements for your records."],
      ["Limits and fees", "Always visible in your account settings."],
    ],
    steps: [
      "Verify your profile.",
      "Open the currencies you need.",
      "Share your details to get paid, or send money out.",
    ],
    cta: true,
  },
  "virtual-cards": {
    title: "Virtual cards",
    icon: "card",
    lead: "Create a virtual card for online and international purchases. Freeze it, set a spending limit and see every transaction.",
    features: [
      ["Instant card", "Create a card and use it for online checkouts."],
      [
        "Freeze and unfreeze",
        "Pause a card immediately if something looks wrong.",
      ],
      ["Spending limits", "Set a limit that suits you."],
      [
        "Protected details",
        "Card details are shown only after you confirm your identity.",
      ],
    ],
    steps: [
      "Verify your profile.",
      "Create your card.",
      "Add it to checkouts and track spending.",
    ],
    cta: true,
  },
  "stocks-etfs": {
    title: "Stocks and ETFs",
    icon: "wealth",
    lead: "Invest in listed companies and exchange-traded funds from your TurboXGlobal account. Each product shows its disclosures before you invest.",
    features: [
      [
        "Read before you invest",
        "Product details and risk information come first.",
      ],
      ["Your holdings", "See what you own and how it is allocated."],
      ["Statements", "Keep records of your investment activity."],
    ],
    steps: [
      "Verify your profile.",
      "Choose a product and read its details.",
      "Invest and track your holdings.",
    ],
    cta: true,
  },
  "real-estate": {
    title: "Real estate",
    icon: "home",
    lead: "Explore real estate opportunities with the information you need to decide: what the investment is, how it works and the risks involved.",
    features: [
      [
        "Plain-language details",
        "Each opportunity explains how it works and what could go wrong.",
      ],
      [
        "Eligibility shown up front",
        "You see whether you can take part before you start.",
      ],
      ["Track your position", "Follow your investments from your dashboard."],
    ],
    steps: [
      "Verify your profile.",
      "Review an opportunity.",
      "Invest and follow its progress.",
    ],
    cta: true,
  },
  portfolio: {
    title: "Portfolio tracking",
    icon: "chart",
    lead: "See everything you hold in one view: balances, digital assets and investments, and how your money is allocated.",
    features: [
      ["One total", "All your holdings combined in one figure."],
      ["Allocation", "See how your money is spread across assets."],
      ["Hide balances", "Hide amounts with one tap when you are in public."],
    ],
    steps: [
      "Open your dashboard.",
      "Review your holdings.",
      "Rebalance by trading or investing.",
    ],
    cta: true,
  },
  about: {
    title: "About TurboXGlobal",
    icon: "globe",
    lead: "TurboXGlobal brings digital assets, payments, multi-currency accounts, cards and investments together in one platform.",
    features: [
      [
        "What we do",
        "We make it simple to trade, pay, hold several currencies and invest, all from one account.",
      ],
      [
        "How we work",
        "We show costs before you confirm, explain what each product does, and keep your history in one place.",
      ],
      [
        "Who it is for",
        "Individuals who want one place for their money, and businesses that want to accept and manage payments.",
      ],
      [
        "Where we are today",
        "This is an investor preview. Accounts and sign-in are real. Balances, prices, payments and verification are simulated, and no regulated service is offered yet.",
      ],
    ],
    steps: [],
  },
  blog: {
    title: "Blog",
    icon: "book",
    lead: "Guides, product updates and market education from the TurboXGlobal team.",
    features: [
      [
        "Getting started",
        "How to set up your account, verify your profile and make your first transaction.",
      ],
      ["Staying safe", "How to protect your account and spot scams."],
      [
        "Product updates",
        "What is new across trading, payments, accounts and cards.",
      ],
    ],
    steps: [],
  },
  careers: {
    title: "Careers",
    icon: "code",
    lead: "We are building one platform for global money. If you want to help, we would like to hear from you.",
    features: [
      ["Engineering", "Build secure, reliable financial software."],
      ["Operations and support", "Help customers get things done."],
      ["Compliance and risk", "Keep customers and the platform safe."],
    ],
    steps: [],
    form: "Send us your details",
  },
  help: {
    title: "Help Center",
    icon: "book",
    lead: "Answers to the most common questions, and a way to reach us when you need a person.",
    features: [
      [
        "Account and verification",
        "How to sign up, verify your profile and update your details.",
      ],
      [
        "Payments and transfers",
        "Fees, receipts, statuses and what to do if a payment fails.",
      ],
      [
        "Cards and accounts",
        "Freeze a card, set limits and find your account details.",
      ],
      [
        "Security",
        "Turn on multi-factor authentication and manage your sessions.",
      ],
    ],
    steps: [],
    form: "Contact support",
  },
  contact: {
    title: "Contact us",
    icon: "globe",
    lead: "Questions about the platform, the investor preview or a partnership? Send us a message and we will reply by email. Please do not send personal financial information.",
    features: [],
    steps: [],
    form: "Send a message",
  },
  business: {
    title: "TurboXGlobal for business",
    icon: "store",
    lead: "Accept payments, hold business funds in several currencies and connect your systems through our API.",
    features: [
      [
        "Payment acceptance",
        "Take cards, wallets and local bank transfers through one integration.",
      ],
      ["Business accounts", "Hold USD, EUR and GBP in your company name."],
      [
        "Know your business",
        "A guided verification for company details, directors and owners, and documents.",
      ],
      [
        "API access",
        "Create payments, check status and receive webhooks from your own systems.",
      ],
    ],
    steps: [
      "Tell us about your business.",
      "Complete business verification.",
      "Integrate and go live.",
    ],
    form: "Talk to our business team",
  },
  developers: {
    title: "Developers",
    icon: "code",
    lead: "Build on TurboXGlobal. Create payments, check their status and receive events in your own systems.",
    features: [
      ["REST and JSON", "Standard HTTP requests and JSON responses."],
      [
        "Idempotency keys",
        "Retry safely without sending the same payment twice.",
      ],
      ["Webhooks", "Receive signed events when something changes."],
      [
        "Scoped API keys",
        "Create keys with only the access they need, and revoke them any time.",
      ],
    ],
    steps: [
      "Request API access.",
      "Create a scoped key in your dashboard.",
      "Make your first request and add a webhook.",
    ],
    form: "Request API access",
  },
  learn: {
    title: "Learn",
    icon: "book",
    lead: "Plain-language guides to help you use TurboXGlobal with confidence.",
    features: [],
    steps: [],
  },
  security: {
    title: "Security",
    icon: "shield",
    lead: "How to keep your TurboXGlobal account safe, and what you can do if something looks wrong.",
    features: [
      [
        "Multi-factor authentication",
        "Turn it on in Settings. It protects your account even if your password is stolen.",
      ],
      ["Unique password", "Use a password you do not use anywhere else."],
      [
        "Review your sessions",
        "See where you are signed in and sign out of devices you do not recognise.",
      ],
      [
        "Beware of impersonators",
        "We will never ask for your password or one-time code. Do not share them with anyone.",
      ],
    ],
    steps: [],
    form: "Report a security concern",
  },
  faq: {
    title: "Frequently asked questions",
    icon: "book",
    lead: "Quick answers about TurboXGlobal.",
    features: [],
    steps: [],
  },
  terms: {
    title: "Terms of use",
    icon: "book",
    lead: "The terms that apply when you use this TurboXGlobal investor preview.",
    features: [],
    steps: [],
    legal: [
      [
        "A product demonstration",
        "This site demonstrates the TurboXGlobal product. It is not a live financial service. You must be at least 18 to create an account.",
      ],
      [
        "Simulated money",
        "Balances, prices, trades, payments, cards, accounts, investments and rewards are simulated. They have no monetary value and cannot be withdrawn, redeemed or transferred outside this site.",
      ],
      [
        "Simulated verification",
        "Identity and business verification in the preview is a demonstration. Do not upload real identity or company documents. Files you choose stay in your browser; only the file name, type and size are recorded.",
      ],
      [
        "No advice",
        "Nothing on this site is investment, legal or tax advice. Illustrative prices are not market quotes.",
      ],
      [
        "Your account",
        "Keep your password private. We may suspend accounts that misuse the preview.",
      ],
      [
        "Changes",
        "Features may change during development. No financial product is promised by this preview.",
      ],
    ],
  },
  privacy: {
    title: "Privacy notice",
    icon: "shield",
    lead: "What this investor preview stores and why.",
    features: [],
    steps: [],
    legal: [
      [
        "What we store",
        "Your name, email address, password hash, acceptance of the terms, session records, preferences, and your simulated activity (balances, transactions, cards, beneficiaries you type in, verification answers and support messages). Waitlist and contact form submissions are stored separately.",
      ],
      [
        "What we do not store",
        "Real payment, bank or card credentials. Identity or company document files: the verification screens record only the file name, type and size. Identity document numbers are stored masked.",
      ],
      [
        "Why",
        "To sign you in, keep your demo consistent between visits and reply to messages you send.",
      ],
      [
        "Security",
        "Passwords are hashed with Argon2id. Sessions use HttpOnly cookies. Verification and reset tokens are stored only as hashes and expire.",
      ],
      [
        "Your choices",
        "You can reset your simulated data from Settings at any time. Please avoid entering sensitive personal or financial information into demo fields.",
      ],
    ],
  },
};

export const faq: [string, string][] = [
  [
    "What is TurboXGlobal?",
    "A platform for trading digital assets, sending money, holding USD, EUR and GBP, using virtual cards and exploring investments, all from one account.",
  ],
  [
    "Is this live? Can I move real money?",
    "No. This is an investor preview. Your account and sign-in are real, but every balance, price, payment and verification decision is simulated.",
  ],
  [
    "How do I create an account?",
    "Select Get Started, enter your details and confirm your email. Then verify your profile to unlock all products.",
  ],
  [
    "Why do I need to verify my identity?",
    "Verification keeps money safe and lets a financial platform meet legal requirements. In the preview, the steps are shown with sample data.",
  ],
  [
    "What fees do I pay?",
    "The fee for each action is shown before you confirm it.",
  ],
  [
    "Which currencies can I hold?",
    "USD, EUR and GBP in your global accounts, plus supported digital assets.",
  ],
  [
    "How can my business integrate?",
    "Switch to a business account, complete business verification, then create API keys and payment links in Fiat Acquiring.",
  ],
];

export const glossary: [string, string][] = [
  [
    "Digital asset",
    "A digital token that can be traded or held, such as a cryptocurrency.",
  ],
  [
    "KYC",
    "Know your customer: the identity checks needed to use regulated services.",
  ],
  [
    "KYB",
    "Know your business: checks on a company, its directors and its owners.",
  ],
  ["Limit order", "An order that only runs at the price you set or better."],
  ["Beneficiary", "The person or business you send money to."],
  ["Settlement", "When funds have finally moved between the parties."],
  ["Reconciliation", "Matching payments to your own records."],
  ["Webhook", "A message our system sends to yours when something changes."],
];

export const nav: [string, [string, [string, string][]][]][] = [
  [
    "Products",
    [
      [
        "Trade",
        [
          ["buy-sell", "Buy & Sell Digital Assets"],
          ["swap", "Swap Coins"],
          ["markets", "Market Overview"],
        ],
      ],
      [
        "Pay",
        [
          ["turboxpay", "TurboXPay"],
          ["bills", "Bills & Utilities"],
          ["transfers", "International Transfers"],
          ["convert", "Currency Conversion"],
          ["merchant", "Merchant Payments"],
        ],
      ],
      [
        "Accounts & Cards",
        [
          ["global-accounts", "Global Accounts"],
          ["virtual-cards", "Virtual Cards"],
        ],
      ],
      [
        "Invest",
        [
          ["stocks-etfs", "Stocks & ETFs"],
          ["real-estate", "Real Estate"],
          ["portfolio", "Portfolio Tracking"],
        ],
      ],
    ],
  ],
  [
    "Company",
    [
      [
        "Company",
        [
          ["about", "About Us"],
          ["careers", "Careers"],
          ["blog", "Blog"],
          ["contact", "Contact Us"],
          ["faq", "FAQ"],
          ["help", "Help & Support"],
        ],
      ],
    ],
  ],
];
