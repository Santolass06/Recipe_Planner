const DEFAULT_IMAGES = [
  {
    path: "/ingredients/cebola.png",
    aliases: ["cebola", "onion", "onions"],
  },
  {
    path: "/ingredients/alho.png",
    aliases: ["alho", "garlic"],
  },
  {
    path: "/ingredients/tomate.png",
    aliases: ["tomate", "tomates", "tomato", "tomatoes"],
  },
  {
    path: "/ingredients/cenoura.png",
    aliases: ["cenoura", "cenouras", "carrot", "carrots"],
  },
  {
    path: "/ingredients/batata.png",
    aliases: ["batata", "batatas", "potato", "potatoes"],
  },
  {
    path: "/ingredients/batata-doce.png",
    aliases: ["batata doce", "batata-doce", "sweet potato", "sweet potatoes"],
  },
  {
    path: "/ingredients/pimento.png",
    aliases: ["pimento", "pimentos", "bell pepper", "pepper", "peppers", "capsicum"],
  },
  {
    path: "/ingredients/curgete.png",
    aliases: ["curgete", "curgetes", "courgette", "courgettes", "zucchini"],
  },
  {
    path: "/ingredients/beringela.png",
    aliases: ["beringela", "beringelas", "eggplant", "aubergine", "aubergines"],
  },
  {
    path: "/ingredients/espinafres.png",
    aliases: ["espinafres", "espinafre", "spinach"],
  },
  {
    path: "/ingredients/alface.png",
    aliases: ["alface", "lettuce", "lechuga", "laitue"],
  },
  {
    path: "/ingredients/couve.png",
    aliases: ["couve", "cabbage", "kale"],
  },
  {
    path: "/ingredients/brocolos.png",
    aliases: ["brocolos", "brócolos", "broccoli"],
  },
  {
    path: "/ingredients/couve-flor.png",
    aliases: ["couve flor", "couve-flor", "cauliflower"],
  },
  {
    path: "/ingredients/ervilhas.png",
    aliases: ["ervilhas", "ervilha", "peas", "pea"],
  },
  {
    path: "/ingredients/milho.png",
    aliases: ["milho", "corn", "maize"],
  },
  {
    path: "/ingredients/cogumelos.png",
    aliases: ["cogumelos", "cogumelo", "mushroom", "mushrooms"],
  },
  {
    path: "/ingredients/pepino.png",
    aliases: ["pepino", "pepinos", "cucumber", "cucumbers"],
  },
  {
    path: "/ingredients/abobora.png",
    aliases: ["abobora", "abóbora", "pumpkin", "squash"],
  },
  {
    path: "/ingredients/rucula.png",
    aliases: ["rucula", "rúcula", "arugula", "rocket", "rucola"],
  },
  {
    path: "/ingredients/alho-frances.png",
    aliases: ["alho frances", "alho-francês", "alho francês", "leek", "leeks"],
  },
  {
    path: "/ingredients/aipo.png",
    aliases: ["aipo", "celery"],
  },
  {
    path: "/ingredients/nabo.png",
    aliases: ["nabo", "nabos", "turnip", "turnips"],
  },
  {
    path: "/ingredients/beterraba.png",
    aliases: ["beterraba", "beetroot", "beet", "beets"],
  },
  {
    path: "/ingredients/espargos.png",
    aliases: ["espargos", "espargo", "asparagus"],
  },
  {
    path: "/ingredients/maca.png",
    aliases: ["maca", "maçã", "macas", "maçãs", "apple", "apples"],
  },
  {
    path: "/ingredients/banana.png",
    aliases: ["banana", "bananas"],
  },
  {
    path: "/ingredients/laranja.png",
    aliases: ["laranja", "laranjas", "orange", "oranges"],
  },
  {
    path: "/ingredients/limao.png",
    aliases: ["limao", "limão", "limoes", "limões", "lemon", "lemons"],
  },
  {
    path: "/ingredients/lima.png",
    aliases: ["lima", "limas", "lime", "limes"],
  },
  {
    path: "/ingredients/pera.png",
    aliases: ["pera", "pêra", "peras", "pêras", "pear", "pears"],
  },
  {
    path: "/ingredients/pessego.png",
    aliases: ["pessego", "pêssego", "pessegos", "pêssegos", "peach", "peaches"],
  },
  {
    path: "/ingredients/ameixa.png",
    aliases: ["ameixa", "ameixas", "plum", "plums"],
  },
  {
    path: "/ingredients/cereja.png",
    aliases: ["cereja", "cerejas", "cherry", "cherries"],
  },
  {
    path: "/ingredients/morango.png",
    aliases: ["morango", "morangos", "strawberry", "strawberries"],
  },
  {
    path: "/ingredients/framboesa.png",
    aliases: ["framboesa", "framboesas", "raspberry", "raspberries"],
  },
  {
    path: "/ingredients/mirtilo.png",
    aliases: ["mirtilo", "mirtilos", "blueberry", "blueberries"],
  },
  {
    path: "/ingredients/ananas.png",
    aliases: ["ananas", "ananás", "abacaxi", "pineapple"],
  },
  {
    path: "/ingredients/manga.png",
    aliases: ["manga", "mangas", "mango", "mangoes"],
  },
  {
    path: "/ingredients/papaia.png",
    aliases: ["papaia", "papaya"],
  },
  {
    path: "/ingredients/kiwi.png",
    aliases: ["kiwi", "kiwis"],
  },
  {
    path: "/ingredients/uva.png",
    aliases: ["uva", "uvas", "grape", "grapes"],
  },
  {
    path: "/ingredients/melao.png",
    aliases: ["melao", "melão", "meloes", "melões", "melon", "cantaloupe"],
  },
  {
    path: "/ingredients/melancia.png",
    aliases: ["melancia", "melancias", "watermelon"],
  },
  {
    path: "/ingredients/coco.png",
    aliases: ["coco", "cocos", "coconut", "coconuts"],
  },
  {
    path: "/ingredients/frango.png",
    aliases: ["frango", "chicken"],
  },
  {
    path: "/ingredients/carne-de-vaca.png",
    aliases: ["carne de vaca", "vaca", "beef"],
  },
  {
    path: "/ingredients/carne-de-porco.png",
    aliases: ["carne de porco", "porco", "pork"],
  },
  {
    path: "/ingredients/peru.png",
    aliases: ["peru", "turkey"],
  },
  {
    path: "/ingredients/cordeiro.png",
    aliases: ["cordeiro", "lamb", "mutton"],
  },
  {
    path: "/ingredients/bacon.png",
    aliases: ["bacon"],
  },
  {
    path: "/ingredients/presunto.png",
    aliases: ["presunto", "ham", "prosciutto"],
  },
  {
    path: "/ingredients/salsichas.png",
    aliases: ["salsichas", "salsicha", "sausage", "sausages"],
  },
  {
    path: "/ingredients/salmao.png",
    aliases: ["salmao", "salmão", "salmon"],
  },
  {
    path: "/ingredients/atum.png",
    aliases: ["atum", "tuna"],
  },
  {
    path: "/ingredients/bacalhau.png",
    aliases: ["bacalhau", "cod"],
  },
  {
    path: "/ingredients/sardinha.png",
    aliases: ["sardinha", "sardinhas", "sardine", "sardines"],
  },
  {
    path: "/ingredients/camarao.png",
    aliases: ["camarao", "camarão", "camaroes", "camarões", "shrimp", "prawn", "prawns"],
  },
  {
    path: "/ingredients/mexilhao.png",
    aliases: ["mexilhao", "mexilhão", "mexilhoes", "mexilhões", "mussel", "mussels"],
  },
  {
    path: "/ingredients/polvo.png",
    aliases: ["polvo", "octopus"],
  },
  {
    path: "/ingredients/lula.png",
    aliases: ["lula", "lulas", "squid", "calamari"],
  },
  {
    path: "/ingredients/ovo.png",
    aliases: ["ovo", "ovos", "egg", "eggs"],
  },
  {
    path: "/ingredients/leite.png",
    aliases: ["leite", "milk"],
  },
  {
    path: "/ingredients/natas.png",
    aliases: ["natas", "cream", "heavy cream"],
  },
  {
    path: "/ingredients/manteiga.png",
    aliases: ["manteiga", "butter"],
  },
  {
    path: "/ingredients/iogurte.png",
    aliases: ["iogurte", "yogurt", "yoghurt"],
  },
  {
    path: "/ingredients/queijo-cheddar.png",
    aliases: ["queijo cheddar", "cheddar"],
  },
  {
    path: "/ingredients/queijo-mozzarella.png",
    aliases: ["queijo mozzarella", "mozarela", "mozzarella"],
  },
  {
    path: "/ingredients/queijo-parmesao.png",
    aliases: ["queijo parmesao", "queijo parmesão", "parmesao", "parmesão", "parmesan"],
  },
  {
    path: "/ingredients/queijo-feta.png",
    aliases: ["queijo feta", "feta"],
  },
  {
    path: "/ingredients/queijo-creme.png",
    aliases: ["queijo creme", "cream cheese"],
  },
  {
    path: "/ingredients/leite-condensado.png",
    aliases: ["leite condensado", "condensed milk"],
  },
  {
    path: "/ingredients/arroz.png",
    aliases: ["arroz", "rice"],
  },
  {
    path: "/ingredients/massa.png",
    aliases: ["massa", "pasta"],
  },
  {
    path: "/ingredients/espaguete.png",
    aliases: ["espaguete", "spaghetti"],
  },
  {
    path: "/ingredients/macarrao.png",
    aliases: ["macarrao", "macarrão", "macaroni"],
  },
  {
    path: "/ingredients/farinha-de-trigo.png",
    aliases: ["farinha de trigo", "wheat flour", "flour"],
  },
  {
    path: "/ingredients/farinha-integral.png",
    aliases: ["farinha integral", "whole wheat flour", "wholemeal flour"],
  },
  {
    path: "/ingredients/aveia.png",
    aliases: ["aveia", "oats", "oatmeal"],
  },
  {
    path: "/ingredients/cevada.png",
    aliases: ["cevada", "barley"],
  },
  {
    path: "/ingredients/quinoa.png",
    aliases: ["quinoa"],
  },
  {
    path: "/ingredients/cuscuz.png",
    aliases: ["cuscuz", "couscous"],
  },
  {
    path: "/ingredients/pao.png",
    aliases: ["pao", "pão", "bread"],
  },
  {
    path: "/ingredients/tortilhas.png",
    aliases: ["tortilhas", "tortilha", "tortilla", "tortillas"],
  },
  {
    path: "/ingredients/massa-folhada.png",
    aliases: ["massa folhada", "puff pastry"],
  },
  {
    path: "/ingredients/feijao-preto.png",
    aliases: ["feijao preto", "feijão preto", "black beans", "black bean"],
  },
  {
    path: "/ingredients/feijao-branco.png",
    aliases: ["feijao branco", "feijão branco", "white beans", "white bean"],
  },
  {
    path: "/ingredients/grao-de-bico.png",
    aliases: ["grao de bico", "grão-de-bico", "grão de bico", "chickpea", "chickpeas", "garbanzo"],
  },
  {
    path: "/ingredients/lentilhas.png",
    aliases: ["lentilhas", "lentilha", "lentils", "lentil"],
  },
  {
    path: "/ingredients/soja.png",
    aliases: ["soja", "soy", "soya", "soybean", "soybeans"],
  },
  {
    path: "/ingredients/amendoas.png",
    aliases: ["amendoas", "amêndoas", "amendoa", "amêndoa", "almond", "almonds"],
  },
  {
    path: "/ingredients/nozes.png",
    aliases: ["nozes", "noz", "walnut", "walnuts", "nuts"],
  },
  {
    path: "/ingredients/avelas.png",
    aliases: ["avelas", "avelãs", "avela", "avelã", "hazelnut", "hazelnuts"],
  },
  {
    path: "/ingredients/cajus.png",
    aliases: ["cajus", "caju", "cashew", "cashews"],
  },
  {
    path: "/ingredients/pistachios.png",
    aliases: ["pistachios", "pistáchios", "pistachio"],
  },
  {
    path: "/ingredients/sal.png",
    aliases: ["sal", "salt"],
  },
  {
    path: "/ingredients/pimenta-preta.png",
    aliases: ["pimenta preta", "black pepper"],
  },
  {
    path: "/ingredients/pimenta-branca.png",
    aliases: ["pimenta branca", "white pepper"],
  },
  {
    path: "/ingredients/paprika.png",
    aliases: ["paprika", "pimentao doce", "pimentão doce"],
  },
  {
    path: "/ingredients/cominhos.png",
    aliases: ["cominhos", "cumin"],
  },
  {
    path: "/ingredients/curcuma.png",
    aliases: ["curcuma", "cúrcuma", "turmeric"],
  },
  {
    path: "/ingredients/canela.png",
    aliases: ["canela", "cinnamon"],
  },
  {
    path: "/ingredients/noz-moscada.png",
    aliases: ["noz moscada", "noz-moscada", "nutmeg"],
  },
  {
    path: "/ingredients/cravinho.png",
    aliases: ["cravinho", "clove", "cloves"],
  },
  {
    path: "/ingredients/gengibre.png",
    aliases: ["gengibre", "ginger"],
  },
  {
    path: "/ingredients/oregaos.png",
    aliases: ["oregaos", "orégãos", "oregano"],
  },
  {
    path: "/ingredients/manjericao.png",
    aliases: ["manjericao", "manjericão", "basil"],
  },
  {
    path: "/ingredients/salsa.png",
    aliases: ["salsa", "parsley"],
  },
  {
    path: "/ingredients/coentros.png",
    aliases: ["coentros", "coriander", "cilantro"],
  },
  {
    path: "/ingredients/tomilho.png",
    aliases: ["tomilho", "thyme"],
  },
  {
    path: "/ingredients/alecrim.png",
    aliases: ["alecrim", "rosemary"],
  },
  {
    path: "/ingredients/louro.png",
    aliases: ["louro", "bay leaf", "bay leaves"],
  },
  {
    path: "/ingredients/hortela.png",
    aliases: ["hortela", "hortelã", "mint"],
  },
  {
    path: "/ingredients/aneto.png",
    aliases: ["aneto", "dill"],
  },
  {
    path: "/ingredients/azeite.png",
    aliases: ["azeite", "olive oil"],
  },
  {
    path: "/ingredients/oleo-vegetal.png",
    aliases: ["oleo vegetal", "óleo vegetal", "vegetable oil", "oil"],
  },
  {
    path: "/ingredients/vinagre.png",
    aliases: ["vinagre", "vinegar"],
  },
  {
    path: "/ingredients/vinagre-balsamico.png",
    aliases: ["vinagre balsamico", "vinagre balsâmico", "balsamic vinegar"],
  },
  {
    path: "/ingredients/molho-de-soja.png",
    aliases: ["molho de soja", "soy sauce"],
  },
  {
    path: "/ingredients/mostarda.png",
    aliases: ["mostarda", "mustard"],
  },
  {
    path: "/ingredients/ketchup.png",
    aliases: ["ketchup", "catsup"],
  },
  {
    path: "/ingredients/maionese.png",
    aliases: ["maionese", "mayonnaise", "mayo"],
  },
  {
    path: "/ingredients/molho-de-tomate.png",
    aliases: ["molho de tomate", "tomato sauce"],
  },
  {
    path: "/ingredients/molho-barbecue.png",
    aliases: ["molho barbecue", "barbecue sauce", "bbq sauce"],
  },
  {
    path: "/ingredients/molho-picante.png",
    aliases: ["molho picante", "hot sauce"],
  },
  {
    path: "/ingredients/molho-pesto.png",
    aliases: ["molho pesto", "pesto"],
  },
  {
    path: "/ingredients/acucar-branco.png",
    aliases: ["acucar branco", "açúcar branco", "white sugar", "sugar"],
  },
  {
    path: "/ingredients/acucar-mascavado.png",
    aliases: ["acucar mascavado", "açúcar mascavado", "brown sugar"],
  },
  {
    path: "/ingredients/mel.png",
    aliases: ["mel", "honey"],
  },
  {
    path: "/ingredients/xarope-de-acer.png",
    aliases: ["xarope de acer", "xarope de ácer", "maple syrup"],
  },
  {
    path: "/ingredients/chocolate.png",
    aliases: ["chocolate"],
  },
  {
    path: "/ingredients/chocolate-negro.png",
    aliases: ["chocolate negro", "dark chocolate"],
  },
  {
    path: "/ingredients/chocolate-de-leite.png",
    aliases: ["chocolate de leite", "milk chocolate"],
  },
  {
    path: "/ingredients/cacau-em-po.png",
    aliases: ["cacau em po", "cacau em pó", "cocoa powder", "cacao powder"],
  },
  {
    path: "/ingredients/baunilha.png",
    aliases: ["baunilha", "vanilla"],
  },
  {
    path: "/ingredients/fermento.png",
    aliases: ["fermento", "yeast", "baking powder"],
  },
  {
    path: "/ingredients/bicarbonato-de-sodio.png",
    aliases: ["bicarbonato de sodio", "bicarbonato de sódio", "baking soda"],
  },
  {
    path: "/ingredients/gelatina.png",
    aliases: ["gelatina", "gelatin", "jelly"],
  },
  {
    path: "/ingredients/caldo-de-galinha.png",
    aliases: ["caldo de galinha", "chicken stock", "chicken broth"],
  },
  {
    path: "/ingredients/caldo-de-legumes.png",
    aliases: ["caldo de legumes", "vegetable stock", "vegetable broth"],
  },
  {
    path: "/ingredients/caldo-de-carne.png",
    aliases: ["caldo de carne", "beef stock", "beef broth"],
  },
  {
    path: "/ingredients/leite-de-coco.png",
    aliases: ["leite de coco", "coconut milk"],
  },
  {
    path: "/ingredients/natas-vegetais.png",
    aliases: ["natas vegetais", "plant cream", "vegetable cream"],
  },
  {
    path: "/ingredients/agua.png",
    aliases: ["agua", "água", "water"],
  },
  {
    path: "/ingredients/vinho-branco.png",
    aliases: ["vinho branco", "white wine"],
  },
  {
    path: "/ingredients/vinho-tinto.png",
    aliases: ["vinho tinto", "red wine"],
  },
  {
    path: "/ingredients/cerveja.png",
    aliases: ["cerveja", "beer"],
  },
  {
    path: "/ingredients/tofu.png",
    aliases: ["tofu"],
  },
  {
    path: "/ingredients/tempeh.png",
    aliases: ["tempeh"],
  },
  {
    path: "/ingredients/leite-de-amendoa.png",
    aliases: ["leite de amendoa", "leite de amêndoa", "almond milk"],
  },
  {
    path: "/ingredients/leite-de-soja.png",
    aliases: ["leite de soja", "soy milk", "soya milk"],
  },
  {
    path: "/ingredients/abacate.png",
    aliases: ["abacate", "avocado"],
  },
  {
    path: "/ingredients/molho-teriyaki.png",
    aliases: ["molho teriyaki", "teriyaki sauce", "teriyaki"],
  },
  {
    path: "/ingredients/wasabi.png",
    aliases: ["wasabi"],
  },
  {
    path: "/ingredients/miso.png",
    aliases: ["miso"],
  },
  {
    path: "/ingredients/algas.png",
    aliases: ["algas", "seaweed", "nori"],
  },
  {
    path: "/ingredients/sriracha.png",
    aliases: ["sriracha"],
  },
  {
    path: "/ingredients/tahini.png",
    aliases: ["tahini"],
  },
  {
    path: "/ingredients/harissa.png",
    aliases: ["harissa"],
  },
  {
    path: "/ingredients/curry-em-po.png",
    aliases: ["curry em po", "curry em pó", "curry powder"],
  },
  {
    path: "/ingredients/pasta-de-curry.png",
    aliases: ["pasta de curry", "curry paste"],
  },
  {
    path: "/ingredients/tamarindo.png",
    aliases: ["tamarindo", "tamarind"],
  },
  {
    path: "/ingredients/acucar-de-coco.png",
    aliases: ["acucar de coco", "açúcar de coco", "coconut sugar"],
  },
  {
    path: "/ingredients/farinha-de-arroz.png",
    aliases: ["farinha de arroz", "rice flour"],
  },
  {
    path: "/ingredients/farinha-de-milho.png",
    aliases: ["farinha de milho", "corn flour", "cornmeal"],
  },
  {
    path: "/ingredients/polenta.png",
    aliases: ["polenta"],
  },
  {
    path: "/ingredients/gnocchi.png",
    aliases: ["gnocchi", "nhoque"],
  },
  {
    path: "/ingredients/ricotta.png",
    aliases: ["ricotta", "ricota"],
  },
  {
    path: "/ingredients/mascarpone.png",
    aliases: ["mascarpone"],
  },
  {
    path: "/ingredients/kefir.png",
    aliases: ["kefir"],
  },
  {
    path: "/ingredients/kombucha.png",
    aliases: ["kombucha"],
  },
  {
    path: "/ingredients/pickles.png",
    aliases: ["pickles", "pickle", "picles"],
  },
  {
    path: "/ingredients/alcaparras.png",
    aliases: ["alcaparras", "capers"],
  },
  {
    path: "/ingredients/anchovas.png",
    aliases: ["anchovas", "anchova", "anchovies", "anchovy"],
  },
  {
    path: "/ingredients/molho-worcestershire.png",
    aliases: ["molho worcestershire", "worcestershire sauce"],
  },
  {
    path: "/ingredients/molho-hoisin.png",
    aliases: ["molho hoisin", "hoisin sauce"],
  },
  {
    path: "/ingredients/molho-oyster.png",
    aliases: ["molho oyster", "oyster sauce", "molho de ostra"],
  },
  {
    path: "/ingredients/panko.png",
    aliases: ["panko"],
  },
  {
    path: "/ingredients/molho-ranch.png",
    aliases: ["molho ranch", "ranch dressing", "ranch sauce"],
  },
  {
    path: "/ingredients/molho-caesar.png",
    aliases: ["molho caesar", "caesar dressing", "caesar sauce"],
  },
  {
    path: "/ingredients/chili-seco.png",
    aliases: ["chili seco", "dried chili", "dried chilli"],
  },
  {
    path: "/ingredients/jalapeno.png",
    aliases: ["jalapeno", "jalapeño"],
  },
  {
    path: "/ingredients/pimenta-malagueta.png",
    aliases: ["pimenta malagueta", "malagueta", "chili pepper", "chilli pepper"],
  },
  {
    path: "/ingredients/sementes-de-sesamo.png",
    aliases: ["sementes de sesamo", "sementes de sésamo", "sesame seeds", "sesame"],
  },
  {
    path: "/ingredients/sementes-de-chia.png",
    aliases: ["sementes de chia", "chia seeds", "chia"],
  },
  {
    path: "/ingredients/linhaca.png",
    aliases: ["linhaca", "linhaça", "flaxseed", "flax seeds"],
  },
  {
    path: "/ingredients/farelo-de-trigo.png",
    aliases: ["farelo de trigo", "wheat bran", "bran"],
  },
  {
    path: "/ingredients/farinha-de-amendoa.png",
    aliases: ["farinha de amendoa", "farinha de amêndoa", "almond flour"],
  },
  {
    path: "/ingredients/acucar-em-po.png",
    aliases: ["acucar em po", "açúcar em pó", "powdered sugar", "icing sugar"],
  },
  {
    path: "/ingredients/glucose.png",
    aliases: ["glucose"],
  },
  {
    path: "/ingredients/margarina.png",
    aliases: ["margarina", "margarine"],
  },
  {
    path: "/ingredients/banha.png",
    aliases: ["banha", "lard"],
  },
  {
    path: "/ingredients/calda-de-acucar.png",
    aliases: ["calda de acucar", "calda de açúcar", "sugar syrup", "simple syrup"],
  },
  {
    path: "/ingredients/essencia-de-baunilha.png",
    aliases: ["essencia de baunilha", "essência de baunilha", "vanilla extract", "vanilla essence"],
  },
  {
    path: "/ingredients/rum.png",
    aliases: ["rum"],
  },
  {
    path: "/ingredients/whisky.png",
    aliases: ["whisky", "whiskey"],
  },
  {
    path: "/ingredients/licor.png",
    aliases: ["licor", "liqueur"],
  },
  {
    path: "/ingredients/cafe.png",
    aliases: ["cafe", "café", "coffee"],
  },
  {
    path: "/ingredients/cha.png",
    aliases: ["cha", "chá", "tea"],
  },
  {
    path: "/ingredients/agua-com-gas.png",
    aliases: ["agua com gas", "água com gás", "sparkling water", "soda water"],
  },
];

function normalizeIngredientName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function defaultIngredientImageFor(name: string) {
  const normalized = ` ${normalizeIngredientName(name)} `;
  if (!normalized.trim()) return null;

  let match: { path: string; score: number } | null = null;
  for (const item of DEFAULT_IMAGES) {
    for (const alias of item.aliases) {
      const normalizedAlias = normalizeIngredientName(alias);
      if (!normalizedAlias || !normalized.includes(` ${normalizedAlias} `)) continue;
      if (!match || normalizedAlias.length > match.score) {
        match = { path: item.path, score: normalizedAlias.length };
      }
    }
  }

  return match?.path ?? null;
}

export function isBundledIngredientImage(path: string) {
  return path.startsWith("/ingredients/");
}
