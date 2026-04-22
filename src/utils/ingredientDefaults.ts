const DEFAULT_IMAGES = [
  {
    path: "/ingredients/cebola.webp",
    aliases: ["cebola", "onion", "onions"],
  },
  {
    path: "/ingredients/alho.webp",
    aliases: ["alho", "garlic"],
  },
  {
    path: "/ingredients/tomate.webp",
    aliases: ["tomate", "tomates", "tomato", "tomatoes"],
  },
  {
    path: "/ingredients/cenoura.webp",
    aliases: ["cenoura", "cenouras", "carrot", "carrots"],
  },
  {
    path: "/ingredients/batata.webp",
    aliases: ["batata", "batatas", "potato", "potatoes"],
  },
  {
    path: "/ingredients/batata-doce.webp",
    aliases: ["batata doce", "batata-doce", "sweet potato", "sweet potatoes"],
  },
  {
    path: "/ingredients/pimento.webp",
    aliases: ["pimento", "pimentos", "bell pepper", "pepper", "peppers", "capsicum"],
  },
  {
    path: "/ingredients/curgete.webp",
    aliases: ["curgete", "curgetes", "courgette", "courgettes", "zucchini"],
  },
  {
    path: "/ingredients/beringela.webp",
    aliases: ["beringela", "beringelas", "eggplant", "aubergine", "aubergines"],
  },
  {
    path: "/ingredients/espinafres.webp",
    aliases: ["espinafres", "espinafre", "spinach"],
  },
  {
    path: "/ingredients/alface.webp",
    aliases: ["alface", "lettuce", "lechuga", "laitue"],
  },
  {
    path: "/ingredients/couve.webp",
    aliases: ["couve", "cabbage", "kale"],
  },
  {
    path: "/ingredients/brocolos.webp",
    aliases: ["brocolos", "brócolos", "broccoli"],
  },
  {
    path: "/ingredients/couve-flor.webp",
    aliases: ["couve flor", "couve-flor", "cauliflower"],
  },
  {
    path: "/ingredients/ervilhas.webp",
    aliases: ["ervilhas", "ervilha", "peas", "pea"],
  },
  {
    path: "/ingredients/milho.webp",
    aliases: ["milho", "corn", "maize"],
  },
  {
    path: "/ingredients/cogumelos.webp",
    aliases: ["cogumelos", "cogumelo", "mushroom", "mushrooms"],
  },
  {
    path: "/ingredients/pepino.webp",
    aliases: ["pepino", "pepinos", "cucumber", "cucumbers"],
  },
  {
    path: "/ingredients/abobora.webp",
    aliases: ["abobora", "abóbora", "pumpkin", "squash"],
  },
  {
    path: "/ingredients/rucula.webp",
    aliases: ["rucula", "rúcula", "arugula", "rocket", "rucola"],
  },
  {
    path: "/ingredients/alho-frances.webp",
    aliases: ["alho frances", "alho-francês", "alho francês", "leek", "leeks"],
  },
  {
    path: "/ingredients/aipo.webp",
    aliases: ["aipo", "celery"],
  },
  {
    path: "/ingredients/nabo.webp",
    aliases: ["nabo", "nabos", "turnip", "turnips"],
  },
  {
    path: "/ingredients/beterraba.webp",
    aliases: ["beterraba", "beetroot", "beet", "beets"],
  },
  {
    path: "/ingredients/espargos.webp",
    aliases: ["espargos", "espargo", "asparagus"],
  },
  {
    path: "/ingredients/maca.webp",
    aliases: ["maca", "maçã", "macas", "maçãs", "apple", "apples"],
  },
  {
    path: "/ingredients/banana.webp",
    aliases: ["banana", "bananas"],
  },
  {
    path: "/ingredients/laranja.webp",
    aliases: ["laranja", "laranjas", "orange", "oranges"],
  },
  {
    path: "/ingredients/limao.webp",
    aliases: ["limao", "limão", "limoes", "limões", "lemon", "lemons"],
  },
  {
    path: "/ingredients/lima.webp",
    aliases: ["lima", "limas", "lime", "limes"],
  },
  {
    path: "/ingredients/pera.webp",
    aliases: ["pera", "pêra", "peras", "pêras", "pear", "pears"],
  },
  {
    path: "/ingredients/pessego.webp",
    aliases: ["pessego", "pêssego", "pessegos", "pêssegos", "peach", "peaches"],
  },
  {
    path: "/ingredients/ameixa.webp",
    aliases: ["ameixa", "ameixas", "plum", "plums"],
  },
  {
    path: "/ingredients/cereja.webp",
    aliases: ["cereja", "cerejas", "cherry", "cherries"],
  },
  {
    path: "/ingredients/morango.webp",
    aliases: ["morango", "morangos", "strawberry", "strawberries"],
  },
  {
    path: "/ingredients/framboesa.webp",
    aliases: ["framboesa", "framboesas", "raspberry", "raspberries"],
  },
  {
    path: "/ingredients/mirtilo.webp",
    aliases: ["mirtilo", "mirtilos", "blueberry", "blueberries"],
  },
  {
    path: "/ingredients/ananas.webp",
    aliases: ["ananas", "ananás", "abacaxi", "pineapple"],
  },
  {
    path: "/ingredients/manga.webp",
    aliases: ["manga", "mangas", "mango", "mangoes"],
  },
  {
    path: "/ingredients/papaia.webp",
    aliases: ["papaia", "papaya"],
  },
  {
    path: "/ingredients/kiwi.webp",
    aliases: ["kiwi", "kiwis"],
  },
  {
    path: "/ingredients/uva.webp",
    aliases: ["uva", "uvas", "grape", "grapes"],
  },
  {
    path: "/ingredients/melao.webp",
    aliases: ["melao", "melão", "meloes", "melões", "melon", "cantaloupe"],
  },
  {
    path: "/ingredients/melancia.webp",
    aliases: ["melancia", "melancias", "watermelon"],
  },
  {
    path: "/ingredients/coco.webp",
    aliases: ["coco", "cocos", "coconut", "coconuts"],
  },
  {
    path: "/ingredients/frango.webp",
    aliases: ["frango", "chicken"],
  },
  {
    path: "/ingredients/carne-de-vaca.webp",
    aliases: ["carne de vaca", "vaca", "beef"],
  },
  {
    path: "/ingredients/carne-de-porco.webp",
    aliases: ["carne de porco", "porco", "pork"],
  },
  {
    path: "/ingredients/peru.webp",
    aliases: ["peru", "turkey"],
  },
  {
    path: "/ingredients/cordeiro.webp",
    aliases: ["cordeiro", "lamb", "mutton"],
  },
  {
    path: "/ingredients/bacon.webp",
    aliases: ["bacon"],
  },
  {
    path: "/ingredients/presunto.webp",
    aliases: ["presunto", "ham", "prosciutto"],
  },
  {
    path: "/ingredients/salsichas.webp",
    aliases: ["salsichas", "salsicha", "sausage", "sausages"],
  },
  {
    path: "/ingredients/salmao.webp",
    aliases: ["salmao", "salmão", "salmon"],
  },
  {
    path: "/ingredients/atum.webp",
    aliases: ["atum", "tuna"],
  },
  {
    path: "/ingredients/bacalhau.webp",
    aliases: ["bacalhau", "cod"],
  },
  {
    path: "/ingredients/sardinha.webp",
    aliases: ["sardinha", "sardinhas", "sardine", "sardines"],
  },
  {
    path: "/ingredients/camarao.webp",
    aliases: ["camarao", "camarão", "camaroes", "camarões", "shrimp", "prawn", "prawns"],
  },
  {
    path: "/ingredients/mexilhao.webp",
    aliases: ["mexilhao", "mexilhão", "mexilhoes", "mexilhões", "mussel", "mussels"],
  },
  {
    path: "/ingredients/polvo.webp",
    aliases: ["polvo", "octopus"],
  },
  {
    path: "/ingredients/lula.webp",
    aliases: ["lula", "lulas", "squid", "calamari"],
  },
  {
    path: "/ingredients/ovo.webp",
    aliases: ["ovo", "ovos", "egg", "eggs"],
  },
  {
    path: "/ingredients/leite.webp",
    aliases: ["leite", "milk"],
  },
  {
    path: "/ingredients/natas.webp",
    aliases: ["natas", "cream", "heavy cream"],
  },
  {
    path: "/ingredients/manteiga.webp",
    aliases: ["manteiga", "butter"],
  },
  {
    path: "/ingredients/iogurte.webp",
    aliases: ["iogurte", "yogurt", "yoghurt"],
  },
  {
    path: "/ingredients/queijo-cheddar.webp",
    aliases: ["queijo cheddar", "cheddar"],
  },
  {
    path: "/ingredients/queijo-mozzarella.webp",
    aliases: ["queijo mozzarella", "mozarela", "mozzarella"],
  },
  {
    path: "/ingredients/queijo-parmesao.webp",
    aliases: ["queijo parmesao", "queijo parmesão", "parmesao", "parmesão", "parmesan"],
  },
  {
    path: "/ingredients/queijo-feta.webp",
    aliases: ["queijo feta", "feta"],
  },
  {
    path: "/ingredients/queijo-creme.webp",
    aliases: ["queijo creme", "cream cheese"],
  },
  {
    path: "/ingredients/leite-condensado.webp",
    aliases: ["leite condensado", "condensed milk"],
  },
  {
    path: "/ingredients/arroz.webp",
    aliases: ["arroz", "rice"],
  },
  {
    path: "/ingredients/massa.webp",
    aliases: ["massa", "pasta"],
  },
  {
    path: "/ingredients/espaguete.webp",
    aliases: ["espaguete", "spaghetti"],
  },
  {
    path: "/ingredients/macarrao.webp",
    aliases: ["macarrao", "macarrão", "macaroni"],
  },
  {
    path: "/ingredients/farinha-de-trigo.webp",
    aliases: ["farinha de trigo", "wheat flour", "flour"],
  },
  {
    path: "/ingredients/farinha-integral.webp",
    aliases: ["farinha integral", "whole wheat flour", "wholemeal flour"],
  },
  {
    path: "/ingredients/aveia.webp",
    aliases: ["aveia", "oats", "oatmeal"],
  },
  {
    path: "/ingredients/cevada.webp",
    aliases: ["cevada", "barley"],
  },
  {
    path: "/ingredients/quinoa.webp",
    aliases: ["quinoa"],
  },
  {
    path: "/ingredients/cuscuz.webp",
    aliases: ["cuscuz", "couscous"],
  },
  {
    path: "/ingredients/pao.webp",
    aliases: ["pao", "pão", "bread"],
  },
  {
    path: "/ingredients/tortilhas.webp",
    aliases: ["tortilhas", "tortilha", "tortilla", "tortillas"],
  },
  {
    path: "/ingredients/massa-folhada.webp",
    aliases: ["massa folhada", "puff pastry"],
  },
  {
    path: "/ingredients/feijao-preto.webp",
    aliases: ["feijao preto", "feijão preto", "black beans", "black bean"],
  },
  {
    path: "/ingredients/feijao-branco.webp",
    aliases: ["feijao branco", "feijão branco", "white beans", "white bean"],
  },
  {
    path: "/ingredients/grao-de-bico.webp",
    aliases: ["grao de bico", "grão-de-bico", "grão de bico", "chickpea", "chickpeas", "garbanzo"],
  },
  {
    path: "/ingredients/lentilhas.webp",
    aliases: ["lentilhas", "lentilha", "lentils", "lentil"],
  },
  {
    path: "/ingredients/soja.webp",
    aliases: ["soja", "soy", "soya", "soybean", "soybeans"],
  },
  {
    path: "/ingredients/amendoas.webp",
    aliases: ["amendoas", "amêndoas", "amendoa", "amêndoa", "almond", "almonds"],
  },
  {
    path: "/ingredients/nozes.webp",
    aliases: ["nozes", "noz", "walnut", "walnuts", "nuts"],
  },
  {
    path: "/ingredients/avelas.webp",
    aliases: ["avelas", "avelãs", "avela", "avelã", "hazelnut", "hazelnuts"],
  },
  {
    path: "/ingredients/cajus.webp",
    aliases: ["cajus", "caju", "cashew", "cashews"],
  },
  {
    path: "/ingredients/pistachios.webp",
    aliases: ["pistachios", "pistáchios", "pistachio"],
  },
  {
    path: "/ingredients/sal.webp",
    aliases: ["sal", "salt"],
  },
  {
    path: "/ingredients/pimenta-preta.webp",
    aliases: ["pimenta preta", "black pepper"],
  },
  {
    path: "/ingredients/pimenta-branca.webp",
    aliases: ["pimenta branca", "white pepper"],
  },
  {
    path: "/ingredients/paprika.webp",
    aliases: ["paprika", "pimentao doce", "pimentão doce"],
  },
  {
    path: "/ingredients/cominhos.webp",
    aliases: ["cominhos", "cumin"],
  },
  {
    path: "/ingredients/curcuma.webp",
    aliases: ["curcuma", "cúrcuma", "turmeric"],
  },
  {
    path: "/ingredients/canela.webp",
    aliases: ["canela", "cinnamon"],
  },
  {
    path: "/ingredients/noz-moscada.webp",
    aliases: ["noz moscada", "noz-moscada", "nutmeg"],
  },
  {
    path: "/ingredients/cravinho.webp",
    aliases: ["cravinho", "clove", "cloves"],
  },
  {
    path: "/ingredients/gengibre.webp",
    aliases: ["gengibre", "ginger"],
  },
  {
    path: "/ingredients/oregaos.webp",
    aliases: ["oregaos", "orégãos", "oregano"],
  },
  {
    path: "/ingredients/manjericao.webp",
    aliases: ["manjericao", "manjericão", "basil"],
  },
  {
    path: "/ingredients/salsa.webp",
    aliases: ["salsa", "parsley"],
  },
  {
    path: "/ingredients/coentros.webp",
    aliases: ["coentros", "coriander", "cilantro"],
  },
  {
    path: "/ingredients/tomilho.webp",
    aliases: ["tomilho", "thyme"],
  },
  {
    path: "/ingredients/alecrim.webp",
    aliases: ["alecrim", "rosemary"],
  },
  {
    path: "/ingredients/louro.webp",
    aliases: ["louro", "bay leaf", "bay leaves"],
  },
  {
    path: "/ingredients/hortela.webp",
    aliases: ["hortela", "hortelã", "mint"],
  },
  {
    path: "/ingredients/aneto.webp",
    aliases: ["aneto", "dill"],
  },
  {
    path: "/ingredients/azeite.webp",
    aliases: ["azeite", "olive oil"],
  },
  {
    path: "/ingredients/oleo-vegetal.webp",
    aliases: ["oleo vegetal", "óleo vegetal", "vegetable oil", "oil"],
  },
  {
    path: "/ingredients/vinagre.webp",
    aliases: ["vinagre", "vinegar"],
  },
  {
    path: "/ingredients/vinagre-balsamico.webp",
    aliases: ["vinagre balsamico", "vinagre balsâmico", "balsamic vinegar"],
  },
  {
    path: "/ingredients/molho-de-soja.webp",
    aliases: ["molho de soja", "soy sauce"],
  },
  {
    path: "/ingredients/mostarda.webp",
    aliases: ["mostarda", "mustard"],
  },
  {
    path: "/ingredients/ketchup.webp",
    aliases: ["ketchup", "catsup"],
  },
  {
    path: "/ingredients/maionese.webp",
    aliases: ["maionese", "mayonnaise", "mayo"],
  },
  {
    path: "/ingredients/molho-de-tomate.webp",
    aliases: ["molho de tomate", "tomato sauce"],
  },
  {
    path: "/ingredients/molho-barbecue.webp",
    aliases: ["molho barbecue", "barbecue sauce", "bbq sauce"],
  },
  {
    path: "/ingredients/molho-picante.webp",
    aliases: ["molho picante", "hot sauce"],
  },
  {
    path: "/ingredients/molho-pesto.webp",
    aliases: ["molho pesto", "pesto"],
  },
  {
    path: "/ingredients/acucar-branco.webp",
    aliases: ["acucar branco", "açúcar branco", "white sugar", "sugar"],
  },
  {
    path: "/ingredients/acucar-mascavado.webp",
    aliases: ["acucar mascavado", "açúcar mascavado", "brown sugar"],
  },
  {
    path: "/ingredients/mel.webp",
    aliases: ["mel", "honey"],
  },
  {
    path: "/ingredients/xarope-de-acer.webp",
    aliases: ["xarope de acer", "xarope de ácer", "maple syrup"],
  },
  {
    path: "/ingredients/chocolate.webp",
    aliases: ["chocolate"],
  },
  {
    path: "/ingredients/chocolate-negro.webp",
    aliases: ["chocolate negro", "dark chocolate"],
  },
  {
    path: "/ingredients/chocolate-de-leite.webp",
    aliases: ["chocolate de leite", "milk chocolate"],
  },
  {
    path: "/ingredients/cacau-em-po.webp",
    aliases: ["cacau em po", "cacau em pó", "cocoa powder", "cacao powder"],
  },
  {
    path: "/ingredients/baunilha.webp",
    aliases: ["baunilha", "vanilla"],
  },
  {
    path: "/ingredients/fermento.webp",
    aliases: ["fermento", "yeast", "baking powder"],
  },
  {
    path: "/ingredients/bicarbonato-de-sodio.webp",
    aliases: ["bicarbonato de sodio", "bicarbonato de sódio", "baking soda"],
  },
  {
    path: "/ingredients/gelatina.webp",
    aliases: ["gelatina", "gelatin", "jelly"],
  },
  {
    path: "/ingredients/caldo-de-galinha.webp",
    aliases: ["caldo de galinha", "chicken stock", "chicken broth"],
  },
  {
    path: "/ingredients/caldo-de-legumes.webp",
    aliases: ["caldo de legumes", "vegetable stock", "vegetable broth"],
  },
  {
    path: "/ingredients/caldo-de-carne.webp",
    aliases: ["caldo de carne", "beef stock", "beef broth"],
  },
  {
    path: "/ingredients/leite-de-coco.webp",
    aliases: ["leite de coco", "coconut milk"],
  },
  {
    path: "/ingredients/natas-vegetais.webp",
    aliases: ["natas vegetais", "plant cream", "vegetable cream"],
  },
  {
    path: "/ingredients/agua.webp",
    aliases: ["agua", "água", "water"],
  },
  {
    path: "/ingredients/vinho-branco.webp",
    aliases: ["vinho branco", "white wine"],
  },
  {
    path: "/ingredients/vinho-tinto.webp",
    aliases: ["vinho tinto", "red wine"],
  },
  {
    path: "/ingredients/cerveja.webp",
    aliases: ["cerveja", "beer"],
  },
  {
    path: "/ingredients/tofu.webp",
    aliases: ["tofu"],
  },
  {
    path: "/ingredients/tempeh.webp",
    aliases: ["tempeh"],
  },
  {
    path: "/ingredients/leite-de-amendoa.webp",
    aliases: ["leite de amendoa", "leite de amêndoa", "almond milk"],
  },
  {
    path: "/ingredients/leite-de-soja.webp",
    aliases: ["leite de soja", "soy milk", "soya milk"],
  },
  {
    path: "/ingredients/abacate.webp",
    aliases: ["abacate", "avocado"],
  },
  {
    path: "/ingredients/molho-teriyaki.webp",
    aliases: ["molho teriyaki", "teriyaki sauce", "teriyaki"],
  },
  {
    path: "/ingredients/wasabi.webp",
    aliases: ["wasabi"],
  },
  {
    path: "/ingredients/miso.webp",
    aliases: ["miso"],
  },
  {
    path: "/ingredients/algas.webp",
    aliases: ["algas", "seaweed", "nori"],
  },
  {
    path: "/ingredients/sriracha.webp",
    aliases: ["sriracha"],
  },
  {
    path: "/ingredients/tahini.webp",
    aliases: ["tahini"],
  },
  {
    path: "/ingredients/harissa.webp",
    aliases: ["harissa"],
  },
  {
    path: "/ingredients/curry-em-po.webp",
    aliases: ["curry em po", "curry em pó", "curry powder"],
  },
  {
    path: "/ingredients/pasta-de-curry.webp",
    aliases: ["pasta de curry", "curry paste"],
  },
  {
    path: "/ingredients/tamarindo.webp",
    aliases: ["tamarindo", "tamarind"],
  },
  {
    path: "/ingredients/acucar-de-coco.webp",
    aliases: ["acucar de coco", "açúcar de coco", "coconut sugar"],
  },
  {
    path: "/ingredients/farinha-de-arroz.webp",
    aliases: ["farinha de arroz", "rice flour"],
  },
  {
    path: "/ingredients/farinha-de-milho.webp",
    aliases: ["farinha de milho", "corn flour", "cornmeal"],
  },
  {
    path: "/ingredients/polenta.webp",
    aliases: ["polenta"],
  },
  {
    path: "/ingredients/gnocchi.webp",
    aliases: ["gnocchi", "nhoque"],
  },
  {
    path: "/ingredients/ricotta.webp",
    aliases: ["ricotta", "ricota"],
  },
  {
    path: "/ingredients/mascarpone.webp",
    aliases: ["mascarpone"],
  },
  {
    path: "/ingredients/kefir.webp",
    aliases: ["kefir"],
  },
  {
    path: "/ingredients/kombucha.webp",
    aliases: ["kombucha"],
  },
  {
    path: "/ingredients/pickles.webp",
    aliases: ["pickles", "pickle", "picles"],
  },
  {
    path: "/ingredients/alcaparras.webp",
    aliases: ["alcaparras", "capers"],
  },
  {
    path: "/ingredients/anchovas.webp",
    aliases: ["anchovas", "anchova", "anchovies", "anchovy"],
  },
  {
    path: "/ingredients/molho-worcestershire.webp",
    aliases: ["molho worcestershire", "worcestershire sauce"],
  },
  {
    path: "/ingredients/molho-hoisin.webp",
    aliases: ["molho hoisin", "hoisin sauce"],
  },
  {
    path: "/ingredients/molho-oyster.webp",
    aliases: ["molho oyster", "oyster sauce", "molho de ostra"],
  },
  {
    path: "/ingredients/panko.webp",
    aliases: ["panko"],
  },
  {
    path: "/ingredients/molho-ranch.webp",
    aliases: ["molho ranch", "ranch dressing", "ranch sauce"],
  },
  {
    path: "/ingredients/molho-caesar.webp",
    aliases: ["molho caesar", "caesar dressing", "caesar sauce"],
  },
  {
    path: "/ingredients/chili-seco.webp",
    aliases: ["chili seco", "dried chili", "dried chilli"],
  },
  {
    path: "/ingredients/jalapeno.webp",
    aliases: ["jalapeno", "jalapeño"],
  },
  {
    path: "/ingredients/pimenta-malagueta.webp",
    aliases: ["pimenta malagueta", "malagueta", "chili pepper", "chilli pepper"],
  },
  {
    path: "/ingredients/sementes-de-sesamo.webp",
    aliases: ["sementes de sesamo", "sementes de sésamo", "sesame seeds", "sesame"],
  },
  {
    path: "/ingredients/sementes-de-chia.webp",
    aliases: ["sementes de chia", "chia seeds", "chia"],
  },
  {
    path: "/ingredients/linhaca.webp",
    aliases: ["linhaca", "linhaça", "flaxseed", "flax seeds"],
  },
  {
    path: "/ingredients/farelo-de-trigo.webp",
    aliases: ["farelo de trigo", "wheat bran", "bran"],
  },
  {
    path: "/ingredients/farinha-de-amendoa.webp",
    aliases: ["farinha de amendoa", "farinha de amêndoa", "almond flour"],
  },
  {
    path: "/ingredients/acucar-em-po.webp",
    aliases: ["acucar em po", "açúcar em pó", "powdered sugar", "icing sugar"],
  },
  {
    path: "/ingredients/glucose.webp",
    aliases: ["glucose"],
  },
  {
    path: "/ingredients/margarina.webp",
    aliases: ["margarina", "margarine"],
  },
  {
    path: "/ingredients/banha.webp",
    aliases: ["banha", "lard"],
  },
  {
    path: "/ingredients/calda-de-acucar.webp",
    aliases: ["calda de acucar", "calda de açúcar", "sugar syrup", "simple syrup"],
  },
  {
    path: "/ingredients/essencia-de-baunilha.webp",
    aliases: ["essencia de baunilha", "essência de baunilha", "vanilla extract", "vanilla essence"],
  },
  {
    path: "/ingredients/rum.webp",
    aliases: ["rum"],
  },
  {
    path: "/ingredients/whisky.webp",
    aliases: ["whisky", "whiskey"],
  },
  {
    path: "/ingredients/licor.webp",
    aliases: ["licor", "liqueur"],
  },
  {
    path: "/ingredients/cafe.webp",
    aliases: ["cafe", "café", "coffee"],
  },
  {
    path: "/ingredients/cha.webp",
    aliases: ["cha", "chá", "tea"],
  },
  {
    path: "/ingredients/agua-com-gas.webp",
    aliases: ["agua com gas", "água com gás", "sparkling water", "soda water"],
  },
];

const EXTRA_DEFAULT_IMAGES = [
  {
    path: "/ingredients/curgete.webp",
    aliases: ["abobrinha"],
  },
  {
    path: "/ingredients/beringela.webp",
    aliases: ["berinjela"],
  },
  {
    path: "/ingredients/pimento.webp",
    aliases: ["pimentao", "pimentão", "pimentao vermelho", "pimentão vermelho", "pimentao amarelo", "pimentão amarelo", "pimentao verde", "pimentão verde"],
  },
  {
    path: "/ingredients/alface.webp",
    aliases: ["alface romana", "alface crespa"],
  },
  {
    path: "/ingredients/brocolos.webp",
    aliases: ["brocolis", "brócolis"],
  },
  {
    path: "/ingredients/couve.webp",
    aliases: ["repolho roxo", "repolho branco", "repolho"],
  },
  {
    path: "/ingredients/nabo.webp",
    aliases: ["rabanete", "mandioquinha", "mandioquinha salsa", "mandioquinha-salsa", "mandioca", "inhame", "cara", "cará"],
  },
  {
    path: "/ingredients/curgete.webp",
    aliases: ["chuchu", "vagem", "quiabo"],
  },
  {
    path: "/ingredients/ervilhas.webp",
    aliases: ["ervilha fresca"],
  },
  {
    path: "/ingredients/milho.webp",
    aliases: ["milho verde"],
  },
  {
    path: "/ingredients/espargos.webp",
    aliases: ["aspargo"],
  },
  {
    path: "/ingredients/espargos.webp",
    aliases: ["alcachofra"],
  },
  {
    path: "/ingredients/aipo.webp",
    aliases: ["salsao", "salsão"],
  },
  {
    path: "/ingredients/alho-frances.webp",
    aliases: ["alho poro", "alho-poró", "alho poró"],
  },
  {
    path: "/ingredients/cogumelos.webp",
    aliases: ["cogumelo paris", "cogumelo shiitake", "cogumelo shimeji", "shiitake", "shimeji"],
  },
  {
    path: "/ingredients/abobora.webp",
    aliases: ["abobora cabotia", "abóbora cabotiá", "abobora moranga", "abóbora moranga", "abobora paulista", "abóbora paulista"],
  },
  {
    path: "/ingredients/pimenta-malagueta.webp",
    aliases: ["pimenta dedo de moca", "pimenta dedo-de-moça", "pimenta biquinho"],
  },
  {
    path: "/ingredients/jalapeno.webp",
    aliases: ["pimenta jalapeno", "pimenta jalapeño"],
  },
  {
    path: "/ingredients/coentros.webp",
    aliases: ["coentro"],
  },
  {
    path: "/ingredients/salsa.webp",
    aliases: ["cebolinha"],
  },
  {
    path: "/ingredients/oregaos.webp",
    aliases: ["oregano fresco", "orégano fresco"],
  },
  {
    path: "/ingredients/salsa.webp",
    aliases: ["salvia", "sálvia"],
  },
  {
    path: "/ingredients/aneto.webp",
    aliases: ["endro", "erva doce", "erva-doce"],
  },
  {
    path: "/ingredients/rucula.webp",
    aliases: ["agriao", "agrião", "mostarda folha", "mostarda (folha)", "escarola", "chicoria", "chicória", "radicchio"],
  },
  {
    path: "/ingredients/feijao-preto.webp",
    aliases: ["feijao carioca", "feijão carioca", "feijao vermelho", "feijão vermelho", "feijao fradinho", "feijão-fradinho", "feijão fradinho", "fava"],
  },
  {
    path: "/ingredients/soja.webp",
    aliases: ["soja em grao", "soja em grão"],
  },
  {
    path: "/ingredients/cevada.webp",
    aliases: ["trigo em grao", "trigo em grão", "amaranto"],
  },
  {
    path: "/ingredients/arroz.webp",
    aliases: ["arroz branco", "arroz integral", "arroz arboreo", "arroz arbóreo", "arroz basmati", "arroz jasmim"],
  },
  {
    path: "/ingredients/aveia.webp",
    aliases: ["aveia em flocos", "farelo de aveia"],
  },
  {
    path: "/ingredients/farinha-de-milho.webp",
    aliases: ["fuba", "fubá", "semolina"],
  },
  {
    path: "/ingredients/espaguete.webp",
    aliases: ["macarrao espaguete", "macarrão espaguete"],
  },
  {
    path: "/ingredients/macarrao.webp",
    aliases: ["macarrao penne", "macarrão penne", "macarrao fusilli", "macarrão fusilli", "lasanha"],
  },
  {
    path: "/ingredients/cuscuz.webp",
    aliases: ["cuscuz marroquino"],
  },
  {
    path: "/ingredients/farinha-de-arroz.webp",
    aliases: ["tapioca"],
  },
  {
    path: "/ingredients/pao.webp",
    aliases: ["pao frances", "pão francês", "pao integral", "pão integral", "pao de centeio", "pão de centeio"],
  },
  {
    path: "/ingredients/tortilhas.webp",
    aliases: ["tortilha de trigo", "tortilha de milho"],
  },
  {
    path: "/ingredients/queijo-mozzarella.webp",
    aliases: ["queijo mucarela", "queijo muçarela", "mucarela", "muçarela"],
  },
  {
    path: "/ingredients/queijo-feta.webp",
    aliases: ["queijo minas", "queijo prato", "queijo coalho", "queijo brie", "queijo gorgonzola"],
  },
  {
    path: "/ingredients/ricotta.webp",
    aliases: ["ricota"],
  },
  {
    path: "/ingredients/queijo-creme.webp",
    aliases: ["requeijao", "requeijão", "cream cheese"],
  },
  {
    path: "/ingredients/leite.webp",
    aliases: ["leite integral", "leite desnatado"],
  },
  {
    path: "/ingredients/iogurte.webp",
    aliases: ["iogurte natural", "iogurte grego"],
  },
  {
    path: "/ingredients/natas.webp",
    aliases: ["creme de leite", "nata"],
  },
  {
    path: "/ingredients/ovo.webp",
    aliases: ["ovo de galinha", "ovo de codorna"],
  },
  {
    path: "/ingredients/frango.webp",
    aliases: ["peito de frango", "coxa de frango", "sobrecoxa de frango"],
  },
  {
    path: "/ingredients/carne-de-vaca.webp",
    aliases: ["carne moida bovina", "carne moída bovina", "acem", "acém", "patinho", "alcatra", "contrafile", "contrafilé", "file mignon", "filé mignon", "costela bovina"],
  },
  {
    path: "/ingredients/carne-de-porco.webp",
    aliases: ["lombo suino", "lombo suíno", "pernil suino", "pernil suíno", "linguica toscana", "linguiça toscana", "salame"],
  },
  {
    path: "/ingredients/salmao.webp",
    aliases: ["tilapia", "tilápia", "merluza"],
  },
  {
    path: "/ingredients/laranja.webp",
    aliases: ["tangerina"],
  },
  {
    path: "/ingredients/ananas.webp",
    aliases: ["abacaxi"],
  },
  {
    path: "/ingredients/papaia.webp",
    aliases: ["mamao", "mamão"],
  },
  {
    path: "/ingredients/mirtilo.webp",
    aliases: ["amora"],
  },
  {
    path: "/ingredients/pessego.webp",
    aliases: ["caqui"],
  },
  {
    path: "/ingredients/ananas.webp",
    aliases: ["maracuja", "maracujá", "goiaba", "figo", "roma", "romã"],
  },
  {
    path: "/ingredients/azeite.webp",
    aliases: ["azeitona verde", "azeitona preta"],
  },
  {
    path: "/ingredients/nozes.webp",
    aliases: ["noz", "castanha do para", "castanha-do-pará", "castanha de caju"],
  },
  {
    path: "/ingredients/amendoas.webp",
    aliases: ["amendoa", "amêndoa"],
  },
  {
    path: "/ingredients/avelas.webp",
    aliases: ["avela", "avelã"],
  },
  {
    path: "/ingredients/pistachios.webp",
    aliases: ["pistache"],
  },
  {
    path: "/ingredients/cajus.webp",
    aliases: ["amendoim"],
  },
  {
    path: "/ingredients/sementes-de-chia.webp",
    aliases: ["semente de girassol", "semente de abobora", "semente de abóbora", "chia"],
  },
  {
    path: "/ingredients/linhaca.webp",
    aliases: ["linhaca", "linhaça"],
  },
  {
    path: "/ingredients/sementes-de-sesamo.webp",
    aliases: ["gergelim"],
  },
  {
    path: "/ingredients/chocolate-negro.webp",
    aliases: ["chocolate meio amargo"],
  },
  {
    path: "/ingredients/acucar-mascavado.webp",
    aliases: ["acucar mascavo", "açúcar mascavo", "acucar demerara", "açúcar demerara"],
  },
  {
    path: "/ingredients/sal.webp",
    aliases: ["sal marinho"],
  },
  {
    path: "/ingredients/pimenta-preta.webp",
    aliases: ["pimenta do reino", "pimenta-do-reino"],
  },
  {
    path: "/ingredients/paprika.webp",
    aliases: ["paprica doce", "páprica doce"],
  },
  {
    path: "/ingredients/curcuma.webp",
    aliases: ["acafrao da terra", "açafrão-da-terra", "açafrão da terra"],
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

const NORMALIZED_IMAGE_ALIASES = [...DEFAULT_IMAGES, ...EXTRA_DEFAULT_IMAGES]
  .flatMap((item) =>
    item.aliases.map((alias) => ({
      alias: normalizeIngredientName(alias),
      path: item.path,
    }))
  )
  .filter((item) => item.alias.length > 0)
  .sort((a, b) => b.alias.length - a.alias.length);

export function defaultIngredientImageFor(name: string) {
  const normalized = ` ${normalizeIngredientName(name)} `;
  if (!normalized.trim()) return null;

  for (const item of NORMALIZED_IMAGE_ALIASES) {
    if (normalized.includes(` ${item.alias} `)) return item.path;
  }

  return null;
}

export function isBundledIngredientImage(path: string) {
  return path.startsWith("/ingredients/");
}
