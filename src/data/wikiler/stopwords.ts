/**
 * Words Wikiler shows from the start: the function words of each language —
 * articles, prepositions, conjunctions, particles, pronouns and auxiliaries.
 * They make a hidden article readable without saying what it is about
 * (docs/wikiler-spec.md, section 2).
 *
 * Written in plain lower case; `ё`, stress marks and letter case are folded
 * the same way as the players' guesses before comparing. A word here can never
 * be guessed ("already open"), so content words — *new*, *first*, *год* — stay
 * out even when they are common.
 *
 * Adding a language: a list here, a stemmer in `src/lib/gameLogic/wikiler.ts`.
 */

const en = `
a an the
and or but nor so yet if then than because as while whereas although though unless until since whether
of in on at to from by with without within into onto upon over under above below between among through
throughout during before after about around against along across behind beyond near off out up down via per
for toward towards despite except including like unlike
i me my mine myself we us our ours ourselves you your yours yourself yourselves
he him his himself she her hers herself it its itself they them their theirs themselves
this that these those who whom whose which what where when why how
there here
is are was were be been being am
has have had having
do does did doing done
will would shall should can could may might must ought
not no yes
all any both each either neither every some such other another own same
more most less least many much few several
only also too very just even still already again ever never always often
s t d ll re ve m
`;

const ru = `
а и но да или либо ни что чтобы чтоб если хотя будто как словно также тоже зато однако причем притом
в во на с со к ко о об обо от ото из изо у за по под подо над надо при про через без для до после перед
около между среди вокруг вдоль внутри вне ради сквозь возле кроме вместо благодаря согласно вследствие
не ни ли же бы ведь вот вон лишь только даже уже еще ещё разве неужели пусть ка то нибудь либо таки
я меня мне мной мною мы нас нам нами
ты тебя тебе тобой тобою вы вас вам вами
он его него ему нему им ним нём нем
она её ее неё нее ей ней ею нею
оно они их них ими ними
себя себе собой собою
мой моя моё мое мои моего моей моему моим моих моими
твой твоя твоё твое твои
наш наша наше наши нашего нашей нашему нашим наших
ваш ваша ваше ваши
свой своя своё свое свои своего своей своему своим своих своими своём своем
этот эта это эти этого этой этому этим этих этими этом
тот та те того той тому тем тех теми том
такой такая такое такие такого такой таким таких
весь вся всё все всего всей всему всем всех всеми
который которая которое которые которого которой которому которым которых которыми котором
кто кого кому кем ком что чего чему чем чём
какой какая какое какие какого каким каких
где куда откуда когда тогда там тут здесь туда сюда оттуда
так как почему зачем сколько столько
быть был была было были будет будут будь есть являлся являлась являлось являлись является являются
может могут мог могла могло могли
также затем потом поэтому
`;

const toSet = (list: string) => new Set(list.split(/\s+/).filter(Boolean));

export const STOP_WORDS = {
  en: toSet(en),
  ru: toSet(ru)
} as const;
