# Gomoku Review

Klientská React/Vite aplikace pro rozbor partií Gomoku. Pozice se vyhodnocují ve Web Workeru, partie neopouští prohlížeč a výsledek lze nasadit na GitHub Pages.

## Vývoj

```sh
npm install
npm run dev
```

Ověření projektu:

```sh
npm test
npm run lint
npm run build
```

## Partie

Import podporuje SGF pro desku 15 × 15 a textové tahy `x,y` nebo `x,y,player` (Piskvork, souřadnice od nuly; hráč `1` je černý a `2` bílý). U SGF se analyzuje hlavní varianta, při větvení první varianta. Kliknutím na prázdný průsečík lze pokračovat v rozehrané partii.

Nová partie začíná prázdnou deskou. Kliknutí přidá kámen a přepíše text na souřadnice; vložení textu nebo SGF aktualizuje desku. Pravé kliknutí na desce vrátí poslední tah. Výběr síly předává workeru limity hloubky a času; panel raw dat zobrazuje stdout/stderr kompatibilního WASM adaptéru, případně označený výstup lokální heuristiky.

Hodnocení používá sigmoid s výchozím `k = 0.01`; pokles šance se měří z pohledu hráče, který zahrál tah. Swap2 používá doporučení nad 60 %, pod 40 % a mezi těmito hodnotami doporučuje položit další dva kameny.

## WASM engine

Worker při startu načte `public/engine/rapfi.js` jednou a opakovaně volá exportované C++ API; adaptér zachovává Rapfi `Search::Engine` a transpoziční tabulku mezi pozicemi. SGF se předá do WASM jako normalizované řádky `x,y,player` z parseru aplikace.

Po instalaci/aktivaci Emscripten SDK spusťte `bash scripts/build-wasm.sh`. Výchozí build používá Rapfiho interní classical eval tabulky, takže nepotřebuje `Networks` submodule a WASM zůstává malý (~1 MB). Rozhraní adaptéru a omezení tohoto výchozího modelu jsou popsány v [public/engine/README.md](public/engine/README.md). Pokud WASM soubor chybí, aplikace přejde na lokální heuristiku ve workeru.

Volitelně lze tlačítkem **Silnější engine · NNUE** stáhnout oficiální mix9svq NNUE síť (~10 MB, CC0) a použít ji místo classical evaluace. Váhy se ukládají do Cache Storage a načítají se do WASM za běhu; při dalším rozboru se znovu použijí z cache. Aktivní režim je v UI označen jako `WASM · NNUE`, vypnutí tlačítkem se vrátí ke classical evaluaci. Tato funkce vyžaduje WASM sestavený s NNUE rozhraním (viz `public/engine/README.md`).

## GitHub Pages

Workflow `.github/workflows/deploy.yml` sestaví aplikaci a publikuje ji při pushi do `main`. Při prvním nasazení otevřete v GitHubu **Settings → Pages** a nastavte **Build and deployment → Source** na **GitHub Actions**. Workflow si vezme base path z `actions/configure-pages`, takže funguje i po změně názvu repozitáře.