// src/constants/categories.ts

export const CATEGORY_GROUPS = {
    STREAMING: [
      "Netflix", "Disney+", "Amazon Prime", "HBO Max", 
      "YouTube Premium", "Spotify", "Apple Music", "Paramount+", 
      "Crunchyroll", "Hulu", "IPTV Premium", "Canal+"
    ],
    GAMING: [
      "Free Fire Diamonds", "PUBG UC", "PlayStation Plus", 
      "Xbox Live", "Steam Wallet", "Roblox Robux", 
      "Nintendo Switch Online", "EA Play", "GTA V Modded Accounts"
    ],
    SOFTWARE: [
      "Microsoft 365", "Adobe Creative Cloud", "Canva Pro", 
      "Windows Key", "Antivirus (Norton/Avast)", "ChatGPT Plus", 
      "Midjourney", "VPN Premium"
    ],
    COURSES: [
      "Udemy", "Coursera", "Skillshare", "Masterclass", "Duolingo Plus"
    ],
    SOCIAL: [
      "Telegram Premium", "X (Twitter) Blue", "Discord Nitro", 
      "Tinder Gold", "Bumble Premium"
    ],
    OTHERS: [
      "Hosting/Domain", "Shopify Store", "Trading Signals", 
      "E-book Access", "Custom Service"
    ]
  };
  
  // Sa a se yon lis plat ki gen tout kategori yo ansanm
  export const ALL_CATEGORIES = Object.values(CATEGORY_GROUPS).flat();