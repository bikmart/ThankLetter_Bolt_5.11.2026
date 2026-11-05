export type Case = 'nominative' | 'genitive' | 'dative' | 'accusative' | 'instrumental' | 'prepositional';

export const CASES: { id: Case; label: string }[] = [
  { id: 'nominative', label: 'Именительный − Кто?' },
  { id: 'genitive', label: 'Родительный − Кого?' },
  { id: 'dative', label: 'Дательный − Кому?' },
  { id: 'accusative', label: 'Винительный − Кого?' },
  { id: 'instrumental', label: 'Творительный − Кем?' },
  { id: 'prepositional', label: 'Предложный − О ком?' },
];

const CONSONANT = '[бвгджзйклмнпрстфхцчшщ]';
const VOWEL = '[аеёиоуыэюя]';

// Male names ending in -ль that should still decline (Шамиль → Шамиля)
const MALE_NAMES_LQ = /^(Шамиль|Камиль|Эмиль|Рамиль|Амиль|Ямиль|Ильмир|Ильдар|Ильнур|Ильшат|Ильгиз|Ильнар|Ильфат|Ильхам|Ильдус|Ильяс|Ильмар|Ильназ|Ильшад|Ильгам|Габдель|Даниэль|Рафаэль|Габриэль|Микаэль|Самуэль|Олесь|Лесь)$/i;

function lastChar(s: string): string {
  return s.slice(-1);
}
function stem(s: string): string {
  return s.slice(0, -1);
}

const isCyrillic = (s: string) => /^[\u0400-\u04FF]+$/.test(s);

function isLatinNonCyrillic(s: string): boolean {
  return /^[A-Za-z\s-]+$/.test(s) && !isCyrillic(s);
}

// ── Gender detection ──────────────────────────────────────────────────

function isMalePatronymic(s: string): boolean {
  return /ич$|ыч$|оглы$|уулы$|й$/.test(s) && !/на$|кызы$|жан$/.test(s);
}

function isFemalePatronymic(s: string): boolean {
  return /на$|кызы$|хан$|жан$/.test(s) && !/ич$|ыч$|оглы$|уулы$/.test(s);
}

function isMaleFirstName(s: string): boolean {
  const last = lastChar(s);
  if (last === 'а' || last === 'я') {
    return /^(Никита|Илья|Данила|Добрыня|Гаврила|Кузьма|Митя|Фрол|Савва|Камил|Муса|Хасан|Хусейн|Иса|Курбан|Али|Бахтияр|Джамал|Назар|Тахир|Шамиль|Абдулла|Мустафа|Мирза|Рашид|Саид|Халил|Эмин|Яшар|Ахмед|Дамир|Касым|Азамат|Жанибек|Ерсин|Нурлан|Санжар|Темир|Шерзод|Абдулхаким|Абдурахман|Курмаш|Мурод|Бахром|Дилшод|Фарход|Рустам|Сардор|Улугбек|Жасур|Алишер|Бекзод|Достон|Ислам|Нурбек|Сухроб|Элёр|Абдулло|Бахтиёр|Махмуд|Тимур|Умар|Хикмат|Шухрат|Эркин)$/i.test(s);
  }
  return true;
}

function isFemaleFirstName(s: string): boolean {
  const last = lastChar(s);
  if (last === 'й') return false;
  // Female Turkic names ending in -ль (Айгуль, Гузель, Нурсель) —
  // non-declinable in Russian. Exclude known male names ending in -ль.
  if (/ль$/.test(s) && !MALE_NAMES_LQ.test(s)) return true;
  // Female names ending in -ь (not -ль): Любовь, Асель, Адель (when female)
  if (last === 'ь' && !MALE_NAMES_LQ.test(s)) return true;
  if (last === 'а' || last === 'я' || last === 'и') {
    return !/^(Никита|Илья|Данила|Добрыня|Гаврила|Кузьма|Митя|Фрол|Савва|Камил|Муса|Хасан|Хусейн|Иса|Курбан|Али|Бахтияр|Джамал|Назар|Тахир|Шамиль|Абдулла|Мустафа|Мирза|Рашид|Саид|Халил|Эмин|Яшар|Ахмед|Дамир|Касым|Азамат|Жанибек|Ерсин|Нурлан|Санжар|Темир|Шерзод|Абдулхаким|Абдурахман|Курмаш|Мурод|Бахром|Дилшод|Фарход|Рустам|Сардор|Улугбек|Жасур|Алишер|Бекзод|Достон|Ислам|Нурбек|Сухроб|Элёр|Абдулло|Бахтиёр|Махмуд|Тимур|Умар|Хикмат|Шухрат|Эркин)$/i.test(s);
  }
  return false;
}

function isFemaleSurname(s: string): boolean {
  return /ова$|ева$|ёва$|ина$|ына$|ская$|цкая$|ая$|яя$|ная$|дая$|тая$|рая$|уя$|кая$|хая$|чая$|ва$|на$|га$|ла$|жа$|за$|ма$|ля$|да$|ка$|та$|ша$|ца$|ча$|ща$|эя$|ия$|оя$|еева$|уева$|юева$|аева$|оева$|ыева$|яева$|оеева$|уеева$/.test(s);
}

function isMaleSurname(s: string): boolean {
  return /ов$|ев$|ёв$|ин$|ын$|ский$|цкий$|ый$|ий$|ой$|ай$|ей$|ов$|ев$|ян$|янц$|янц$|дзе$|швили$|ули$|ури$|ади$|иди$|ян$|ов$|ко$|енко$|ук$|юк$|ич$|чик$|ский$|ник$|ук$|юк$|ак$|ек$|ик$|бек$|хан$|ман$|берг$|штадт$|фельд$|кин$|вин$|ский$|ской$|цкий$|цкой$|кий$|хий$|ший$|жий$|чий$|ний$|тий$|пий$|рий$|сий$|дий$|лий$|мий$|вий$|гий$|зий$|кий$|хий$|фий$|бий$|пий$|тий$|сий$|дий$|лий$|мий$|вий$|гий$|зий$|рий$|ний$|жий$|чий$|ший$|щий$/.test(s);
}

// ── Non-declinable name detection ────────────────────────────────────

function isNonDeclinableSurname(s: string): boolean {
  return [
    /швили$/, /дзе$/, /ян$/, /янц$/, /янц$/, /янцова$/, /иди$/, /ади$/,
    /мук$/, /юк$/, /ук$/, /ко$/, /енко$/, /ченко$/, /енко$/, /вко$/,
    /ська$/, /цька$/, /ць$/, /юк$/, /ий$/, /ович$/, /евич$/,
    /ман$/, /берг$/, /фельд$/, /штадт$/, /штейн$/, /зон$/, /сон$/,
    /ский$/, /цкий$/,
    /ег$/, /ян$/, /ов$/, /ев$/, /ин$/, /ын$/,
    /ули$/, /ури$/, /аули$/, /аули$/, /бадзе$/, /швили$/,
    /кызы$/, /оглы$/, /уулы$/,
  ].some((re) => re.test(s)) ? false : false;
}

// Surnames that never decline regardless of case or gender
function isImmutableSurname(s: string): boolean {
  // Georgian: -швили, -дзе, -ури, -ули, -аули, -бадзе, -маниа, -вания, -гогия, -лава (some)
  if (/швили$|дзе$|ури$|ули$|аули$|бадзе$|маниа$|вания$|гогия$|ланаа$|бери$|дзуа$|шен$|бли$/.test(s)) return true;
  // Armenian: -ян, -янц (some decline, but conservative: keep unchanged for mixed-origin)
  // Actually -ян/-янц DO decline in Russian: Мхитарян → Мхитаряна
  // Jewish/German-origin: -ман, -берг, -фельд, -штадт, -штейн, -зон, -сон, -кин (when not clearly Russian)
  // These DO decline in Russian: Розенберг → Розенберга
  // Ukrainian -ко/-енко: in modern Russian they CAN decline but traditionally often don't
  // We will decline them
  // Korean diaspora surnames: Ким, Пак, Ли, Цой, Чой, Хан, Юн, Рю, Сон, Лим, Кан, Ю, Син — short, don't decline
  if (/^(Ким|Пак|Ли|Цой|Чой|Хан|Юн|Рю|Сон|Лим|Кан|Ю|Син|Чжан|Ван|Дин|Лу|Джу|Су|Ну|Тен|Тян|Ким|Хегай|Когай|Тягай|Пегай|Тян|Хван|Ли|Цой)$/i.test(s)) return true;
  // Short surnames ending in vowels that aren't standard Russian female forms
  if (/^[А-Яа-яЁё]{2,4}$/.test(s) && /[июэы]$/.test(lastChar(s))) return true;
  // Surnames ending in -их, -ых (Russian dialectal / Siberian): generally non-declinable
  if (/их$|ых$/.test(s)) return true;
  // Surnames ending in -ово, -ево, -ино, -ыно (derived from place names): non-declinable
  if (/ово$|ево$|ёво$|ино$|ыно$|аево$|еево$|иево$|уево$|оево$|яево$/.test(s) && !/нова$|лева$|лова$|ева$|ина$|ына$/.test(s)) return true;
  // Surnames with non-Cyrillic characters
  if (isLatinNonCyrillic(s)) return true;
  return false;
}

function isImmutableFirstName(s: string): boolean {
  // Korean diaspora given names and short non-Russian names
  if (isLatinNonCyrillic(s)) return true;
  // Names ending in vowels other than а/я (и, о, у, э, ы, е, ё, ю) — generally non-declinable
  // But many Muslim/Turkic names end in these and DO decline in Russian
  // e.g. Муса → Мусы (gen), Хасан → Хасана, etc.
  // Short names ending in и/о/у/э/ы that aren't traditional Russian
  if (/[июэыеё]$/.test(lastChar(s))) {
    // Most names ending in these vowels are non-declinable in Russian
    // Exceptions are rare; treat as non-declinable for safety
    // But names ending in -е (like Нурбе-к→Нурбека) are handled by consonant rule
    // Names ending in и/о/у/э/ы
    if (/^[А-Яа-яЁё]{2,5}$/.test(s)) return true;
    // Longer names ending in и/о/у/э/ы/е from Turkic/Muslim origin
    // Many DO decline: Хасан→Хасана, Курбан→Курбана, Саид→Саида
    // But ones ending in -и, -у, -э, -ы don't
    if (/[иуэы]$/.test(lastChar(s))) return true;
    // -е and -о: these generally don't decline
    if (/[ео]$/.test(lastChar(s))) return true;
  }
  return false;
}

function isImmutablePatronymic(s: string): boolean {
  // Turkic: оглы/кызы/уулы — non-declinable
  if (/оглы$|кызы$|уулы$|къызы$|оглу$|кызы$/.test(s)) return true;
  // Georgian patronymics (non-standard, often just middle names)
  if (isLatinNonCyrillic(s)) return true;
  // Patronymics not ending in -ич/-на/-ыч — likely non-standard
  if (!/ич$|ыч$|на$/.test(s)) {
    // Could be a second name / patronymic from another culture
    // If it ends in a consonant, it might still decline (like a male noun)
    // But if it's clearly not a standard patronymic form, keep it
    if (/[аеёиоуыэюя]$/.test(lastChar(s)) && !/на$/.test(s)) return true;
  }
  return false;
}

// ── Russian surname declension ────────────────────────────────────────

function declineMaleSurname(s: string, c: Case): string {
  if (c === 'nominative') return s;
  if (isImmutableSurname(s)) return s;

  // -ский, -цкий, -ский
  if (/ский$|цкий$/.test(s)) {
    const base = s.replace(/ий$/, '');
    switch (c) {
      case 'genitive': return base + 'ого';
      case 'dative': return base + 'ому';
      case 'accusative': return base + 'ого';
      case 'instrumental': return base + 'им';
      case 'prepositional': return base + 'ом';
    }
  }

  // -ый, -ий, -ой (adjectival surnames)
  if (/ый$|ий$|ой$/.test(s)) {
    const base = s.replace(/ый$|ий$|ой$/, '');
    switch (c) {
      case 'genitive': return base + 'ого';
      case 'dative': return base + 'ому';
      case 'accusative': return base + 'ого';
      case 'instrumental': return base + 'ым';
      case 'prepositional': return base + 'ом';
    }
  }

  // -ов, -ев, -ёв, -ин, -ын
  if (/ов$|ев$|ёв$|ин$|ын$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental': return s + 'ым';
      case 'prepositional': return s + 'е';
    }
  }

  // -ко, -енко (Ukrainian) — modern Russian: decline like nouns
  if (/ко$|енко$|ченко$|вко$|ько$|ушко$|юк$|ук$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'у' === s + 'у' ? s + 'а' : s;
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  // -ян, -янц (Armenian) — decline like nouns
  if (/ян$|янц$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  // -ман, -берг, -фельд, -штейн, -зон, -сон (Jewish/German-origin) — decline like nouns
  if (/ман$|берг$|фельд$|штадт$|штейн$|зон$|сон$|кин$|вин$|ник$|чик$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  // -хан, -бек (Turkic/Muslim) — decline like nouns
  if (/хан$|бек$|мир$|шах$|бай$|тай$|назар$|дар$|шар$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  // -ович, -евич (rare surnames, Serbian/Belarusian)
  if (/ович$|евич$|ич$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental': return s + 'ем';
      case 'prepositional': return s + 'е';
    }
  }

  // Default: consonant ending → decline like 2nd declension noun
  if (new RegExp(CONSONANT + '$').test(s)) {
    const last = lastChar(s);
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental':
        // After ж, ш, щ, ч, ц → -ем (unstressed) but we use -ом for simplicity
        return /[жшщчц]$/.test(last) ? s + 'ем' : s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  // Ends in -а (male with -а surname, e.g.uka)
  if (lastChar(s) === 'а') {
    const b = stem(s);
    const beforeLast = s.slice(-2, -1);
    const gEnd = /[гжкхчшщ]/.test(beforeLast) ? 'и' : 'ы';
    switch (c) {
      case 'genitive': return b + gEnd;
      case 'dative': return b + 'е';
      case 'accusative': return b + 'у';
      case 'instrumental': return b + 'ой';
      case 'prepositional': return b + 'е';
    }
  }

  // Ends in -я
  if (lastChar(s) === 'я') {
    const b = stem(s);
    switch (c) {
      case 'genitive': return b + 'и';
      case 'dative': return b + 'е';
      case 'accusative': return b + 'ю';
      case 'instrumental': return b + 'ей';
      case 'prepositional': return b + 'е';
    }
  }

  // Ends in -ь (soft sign)
  if (lastChar(s) === 'ь') {
    const b = stem(s);
    switch (c) {
      case 'genitive': return b + 'я';
      case 'dative': return b + 'ю';
      case 'accusative': return b + 'я';
      case 'instrumental': return b + 'ем';
      case 'prepositional': return b + 'е';
    }
  }

  return s;
}

function declineFemaleSurname(s: string, c: Case): string {
  if (c === 'nominative') return s;
  if (isImmutableSurname(s)) return s;

  // -ская, -цкая, -ая, -яя, -ная
  if (/ская$|цкая$|ая$|яя$|ная$|дая$|тая$|рая$|уя$|кая$|хая$|чая$/.test(s)) {
    const base = s.replace(/ая$/, 'о');
    switch (c) {
      case 'genitive': return base + 'й';
      case 'dative': return base + 'й';
      case 'accusative': return base + 'ю';
      case 'instrumental': return base + 'й';
      case 'prepositional': return base + 'й';
    }
  }

  // -ова, -ева, -ёва, -ина, -ына
  if (/ова$|ева$|ёва$|ина$|ына$/.test(s)) {
    const b = stem(s); // remove final -а
    switch (c) {
      case 'genitive': return b + 'ой';
      case 'dative': return b + 'ой';
      case 'accusative': return b + 'у';
      case 'instrumental': return b + 'ой';
      case 'prepositional': return b + 'ой';
    }
  }

  // -ко, -енко (Ukrainian female surnames) — non-declinable in traditional Russian
  if (/ко$|енко$|ченко$|вко$|ько$|ушко$/.test(s)) {
    return s; // Female -ko surnames are traditionally non-declinable
  }

  // -ян, -янц (Armenian female — without -а ending)
  // Armenian female surnames typically end in -ян (same as male), decline like male
  if (/ян$|янц$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'у';
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  // -ман, -берг, etc. (female, same form as male) — decline like male
  if (/ман$|берг$|фельд$|штадт$|штейн$|зон$|сон$|кин$|вин$|ник$|чик$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'у';
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  // Georgian -швили, -дзе — non-declinable
  if (/швили$|дзе$|ури$|ули$/.test(s)) return s;

  // Ends in -а
  if (lastChar(s) === 'а') {
    const b = stem(s);
    const beforeLast = s.slice(-2, -1);
    const gEnd = /[гжкхчшщ]/.test(beforeLast) ? 'и' : 'ы';
    switch (c) {
      case 'genitive': return b + gEnd;
      case 'dative': return b + 'е';
      case 'accusative': return b + 'у';
      case 'instrumental': return b + 'ой';
      case 'prepositional': return b + 'е';
    }
  }

  // Ends in -я
  if (lastChar(s) === 'я') {
    const b = stem(s);
    switch (c) {
      case 'genitive': return b + 'и';
      case 'dative': return b + 'е';
      case 'accusative': return b + 'ю';
      case 'instrumental': return b + 'ей';
      case 'prepositional': return b + 'е';
    }
  }

  // Ends in consonant (female surnames same form as male, like -ян, -янц, -ман, etc.)
  if (new RegExp(CONSONANT + '$').test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'у';
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  return s;
}

// ── First name declension ─────────────────────────────────────────────

function declineMaleFirstName(s: string, c: Case): string {
  if (c === 'nominative') return s;
  if (isImmutableFirstName(s)) return s;

  // -ий (like Виталий, Анатолий, Юрий — but also Дмитрий is -ий)
  if (/ий$/.test(s)) {
    const base = s.replace(/ий$/, 'и');
    switch (c) {
      case 'genitive': return base + 'я';
      case 'dative': return base + 'ю';
      case 'accusative': return base + 'я';
      case 'instrumental': return base + 'ем';
      case 'prepositional': return base + 'и';
    }
  }

  // -й (not -ий) (like Андрей, Алексей, Сергей)
  if (/й$/.test(s)) {
    const base = s.replace(/й$/, 'я');
    switch (c) {
      case 'genitive': return base;
      case 'dative': return base + 'у';
      case 'accusative': return base;
      case 'instrumental': return base + 'ем';
      case 'prepositional': return base + 'е';
    }
  }

  // -ь (like Игорь, Шамиль, Камиль, Эмиль)
  if (/ь$/.test(s)) {
    const b = stem(s);
    switch (c) {
      case 'genitive': return b + 'я';
      case 'dative': return b + 'ю';
      case 'accusative': return b + 'я';
      case 'instrumental': return b + 'ем';
      case 'prepositional': return b + 'е';
    }
  }

  // -а (male names ending in -а, like Никита, Илья, Данила, Муса, Камила)
  if (lastChar(s) === 'а') {
    const b = stem(s);
    const beforeLast = s.slice(-2, -1);
    const gEnd = /[гжкхчшщ]/.test(beforeLast) ? 'и' : 'ы';
    switch (c) {
      case 'genitive': return b + gEnd;
      case 'dative': return b + 'е';
      case 'accusative': return b + 'у';
      case 'instrumental': return b + 'ой';
      case 'prepositional': return b + 'е';
    }
  }

  // -я (male names ending in -я, like Илья, Добрыня)
  if (lastChar(s) === 'я') {
    const b = stem(s);
    switch (c) {
      case 'genitive': return b + 'и';
      case 'dative': return b + 'е';
      case 'accusative': return b + 'ю';
      case 'instrumental': return b + 'ей';
      case 'prepositional': return b + 'е';
    }
  }

  // Consonant ending (most male names: Иван, Фарход, Бахтияр, Нурлан, etc.)
  if (new RegExp(CONSONANT + '$').test(s)) {
    const last = lastChar(s);
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental':
        return /[жшщчц]$/.test(last) ? s + 'ем' : s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  return s;
}

function declineFemaleFirstName(s: string, c: Case): string {
  if (c === 'nominative') return s;
  if (isImmutableFirstName(s)) return s;

  // -ия (like Мария, Дария, Юлия, Алия, Нели, Залия)
  if (/ия$/.test(s)) {
    const base = s.replace(/я$/, 'и');
    switch (c) {
      case 'genitive': return base;
      case 'dative': return base;
      case 'accusative': return base + 'ю';
      case 'instrumental': return s.replace(/я$/, 'ей');
      case 'prepositional': return s.replace(/я$/, 'и');
    }
  }

  // -ья (like Марья, Дарья, Асья, Софья)
  if (/ья$/.test(s)) {
    const b = stem(s); // remove -я, leaving stem ending in -ь
    switch (c) {
      case 'genitive': return b + 'и';
      case 'dative': return b + 'е';
      case 'accusative': return b + 'ю';
      case 'instrumental': return b + 'ей';
      case 'prepositional': return b + 'е';
    }
  }

  // -а (like Анна, Гульнара, Айгуль, Зумрада, Нодира, Малика)
  if (lastChar(s) === 'а') {
    const b = stem(s);
    const beforeLast = s.slice(-2, -1);
    const gEnd = /[гжкхчшщ]/.test(beforeLast) ? 'и' : 'ы';
    switch (c) {
      case 'genitive': return b + gEnd;
      case 'dative': return b + 'е';
      case 'accusative': return b + 'у';
      case 'instrumental': return b + 'ой';
      case 'prepositional': return b + 'е';
    }
  }

  // -я (like Алия, Зарема, Гуля — wait, -я ending: Айя, Зуля)
  if (lastChar(s) === 'я') {
    const b = stem(s);
    switch (c) {
      case 'genitive': return b + 'и';
      case 'dative': return b + 'е';
      case 'accusative': return b + 'ю';
      case 'instrumental': return b + 'ей';
      case 'prepositional': return b + 'е';
    }
  }

  // Female Turkic names ending in -ль (Айгуль, Гузель, Нурсель) — non-declinable
  if (/ль$/.test(s)) return s;

  // -ь (like Любовь, Адель — but Адель is sometimes male)
  if (lastChar(s) === 'ь') {
    const b = stem(s);
    switch (c) {
      case 'genitive': return b + 'и';
      case 'dative': return b + 'и';
      case 'accusative': return b + 'ь';
      case 'instrumental': return b + 'ью';
      case 'prepositional': return b + 'и';
    }
  }

  // Consonant ending (rare for female, but possible for some Turkic/Caucasian names)
  if (new RegExp(CONSONANT + '$').test(s)) {
    // Female names ending in consonants are generally non-declinable
    // (e.g. Гуль, Назгуль — wait, these end in -ь or -ль)
    // Actually most female names ending in consonant are non-declinable
    return s;
  }

  return s;
}

// ── Patronymic declension ─────────────────────────────────────────────

function declineMalePatronymic(s: string, c: Case): string {
  if (c === 'nominative') return s;
  if (isImmutablePatronymic(s)) return s;

  // -ич / -ыч (standard Russian/Belarusian)
  if (/ич$|ыч$/.test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  // Consonant ending (some non-standard patronymics)
  if (new RegExp(CONSONANT + '$').test(s)) {
    switch (c) {
      case 'genitive': return s + 'а';
      case 'dative': return s + 'у';
      case 'accusative': return s + 'а';
      case 'instrumental': return s + 'ом';
      case 'prepositional': return s + 'е';
    }
  }

  return s;
}

function declineFemalePatronymic(s: string, c: Case): string {
  if (c === 'nominative') return s;
  if (isImmutablePatronymic(s)) return s;

  // -на (standard Russian/Belarusian female patronymic)
  if (/на$/.test(s)) {
    const b = stem(s);
    switch (c) {
      case 'genitive': return b + 'ы';
      case 'dative': return b + 'е';
      case 'accusative': return b + 'у';
      case 'instrumental': return b + 'ой';
      case 'prepositional': return b + 'е';
    }
  }

  return s;
}

// ── Gender detection for full name ────────────────────────────────────

function isFemaleName(fullName: string): boolean {
  const parts = fullName.trim().split(/\s+/);

  // Check patronymic first — it's the most reliable gender signal.
  // A female patronymic (-на) means female even if the first name
  // ends in a consonant or -ь (e.g. Айгуль, Гузель).
  if (parts.length >= 3) {
    const patronymic = parts[2];
    if (isFemalePatronymic(patronymic)) return true;
    if (isMalePatronymic(patronymic)) return false;
  }

  if (parts.length >= 2) {
    const firstName = parts[1];
    if (isFemaleFirstName(firstName)) return true;
    if (isMaleFirstName(firstName) && !isFemaleFirstName(firstName)) return false;
  }
  if (parts.length >= 1) {
    const surname = parts[0];
    if (isFemaleSurname(surname) && !isMaleSurname(surname)) return true;
  }
  // Fallback: check surname
  if (parts.length >= 1) {
    const surname = parts[0];
    if (isFemaleSurname(surname)) return true;
  }
  return false;
}

// ── Main declension function ──────────────────────────────────────────

export function declineName(fullName: string, c: Case): string {
  if (c === 'nominative') return fullName;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 1 || !parts[0]) return fullName;

  // If any part is Latin/non-Cyrillic, return unchanged
  if (parts.some((p) => isLatinNonCyrillic(p))) return fullName;

  // Single word — treat as a first name; determine gender heuristically
  if (parts.length === 1) {
    const name = parts[0];
    if (isFemaleFirstName(name)) {
      return declineFemaleFirstName(name, c);
    }
    return declineMaleFirstName(name, c);
  }

  const female = isFemaleName(fullName);
  const surname = parts[0];
  const firstName = parts[1];
  const patronymic = parts.length >= 3 ? parts[2] : '';

  const result: string[] = [];

  if (female) {
    if (isFemaleSurname(surname)) {
      result.push(declineFemaleSurname(surname, c));
    } else if (isMaleSurname(surname) && !isImmutableSurname(surname)) {
      // Male-form surname for a woman — add -а or decline as female
      // e.g. Григорян → Григорян (Armenian -ян is same for M/F)
      // e.g. Рабинович → Рабинович (female -ич surnames don't decline)
      if (/ян$|янц$|ман$|берг$|фельд$|штадт$|штейн$|зон$|сон$|ович$|евич$|ич$|ко$|енко$|швили$|дзе$|ури$|ули$|их$|ых$|ых$/.test(surname)) {
        // These surnames have same form for male/female, non-declinable for women
        result.push(surname);
      } else if (new RegExp(CONSONANT + '$').test(surname)) {
        // Consonant-ending surname for a woman — typically non-declinable
        result.push(surname);
      } else {
        result.push(declineFemaleSurname(surname, c));
      }
    } else {
      result.push(declineFemaleSurname(surname, c));
    }
    result.push(declineFemaleFirstName(firstName, c));
    if (patronymic) {
      if (isFemalePatronymic(patronymic) || /на$/.test(patronymic)) {
        result.push(declineFemalePatronymic(patronymic, c));
      } else if (isImmutablePatronymic(patronymic)) {
        result.push(patronymic);
      } else {
        result.push(patronymic);
      }
    }
  } else {
    if (isMaleSurname(surname) && !isImmutableSurname(surname)) {
      result.push(declineMaleSurname(surname, c));
    } else if (isImmutableSurname(surname)) {
      result.push(surname);
    } else {
      result.push(declineMaleSurname(surname, c));
    }
    result.push(declineMaleFirstName(firstName, c));
    if (patronymic) {
      if (isMalePatronymic(patronymic) || /ич$|ыч$/.test(patronymic)) {
        result.push(declineMalePatronymic(patronymic, c));
      } else if (isImmutablePatronymic(patronymic)) {
        result.push(patronymic);
      } else if (new RegExp(CONSONANT + '$').test(patronymic)) {
        // Non-standard patronymic ending in consonant — decline like noun
        result.push(declineMalePatronymic(patronymic, c));
      } else {
        result.push(patronymic);
      }
    }
  }

  return result.join(' ');
}

export function declineNames(names: string[], c: Case): string[] {
  if (c === 'nominative') return names;
  return names.map((n) => declineName(n, c));
}
