/**
 * Fichas de teoría. Cada una explica un concepto en pocas líneas, con sus
 * fórmulas (en LaTeX) y los bloques donde verlo en acción. Los `aliases` son
 * las etiquetas de conceptos de los bloques que abren esta ficha.
 */
export interface Concept {
  id: string;
  title: string;
  aliases: string[];
  /** Párrafos de explicación. */
  body: string[];
  formulas: { tex: string; caption: string }[];
  /** Bloques donde experimentarlo. */
  blocks: string[];
  related: string[];
}

export const concepts: Concept[] = [
  {
    id: 'muestreo',
    title: 'Muestreo y teorema de Nyquist',
    aliases: ['Muestreo', 'Teorema de Nyquist', 'Frecuencia de muestreo', 'Conversión A/D', 'Digitalización', 'Captura de audio'],
    body: [
      'Digitalizar un sonido empieza por medir su amplitud a intervalos regulares: fs veces por segundo. La pregunta es cuántas medidas hacen falta para no perder nada.',
      'El teorema de muestreo (Nyquist-Shannon) responde: si la señal no tiene frecuencias por encima de B, basta con muestrear a más de 2B. La mitad de la frecuencia de muestreo, fs/2, se llama frecuencia de Nyquist: es la máxima que se puede representar.',
      'Por eso la telefonía muestrea a 8 kHz (voz hasta unos 3,4 kHz), la voz de banda ancha a 16 kHz y la música a 44,1 o 48 kHz (el oído llega a unos 20 kHz).',
    ],
    formulas: [
      { tex: 'x[n] = x_a(nT_s), \\quad T_s = \\frac{1}{f_s}', caption: 'Cada muestra es el valor de la señal analógica en el instante nTs.' },
      { tex: 'f_s > 2B \\quad\\Longrightarrow\\quad f_{\\max} = \\frac{f_s}{2}', caption: 'Condición de Nyquist y frecuencia máxima representable.' },
    ],
    blocks: ['resampler', 'generator', 'rate-change'],
    related: ['aliasing', 'cuantizacion'],
  },
  {
    id: 'aliasing',
    title: 'Aliasing y filtro antialiasing',
    aliases: ['Aliasing', 'Filtro antialiasing', 'Cancelación de aliasing', 'Imágenes espectrales'],
    body: [
      'Si al muestrear hay frecuencias por encima de fs/2, no desaparecen: se «doblan» alrededor de fs/2 y aparecen como frecuencias falsas, indistinguibles de las reales. Un tono de 3 kHz muestreado a 4 kHz suena como uno de 1 kHz.',
      'La solución es quitar antes de muestrear todo lo que esté por encima de fs/2 con un filtro paso bajo: el filtro antialiasing. Un filtro real no corta en seco, así que se deja un margen (por ejemplo, corte a 0,45·fs).',
      'Al revés, al subir la frecuencia de muestreo (interpolar) aparecen copias del espectro, las imágenes, que se quitan también con un paso bajo. En un banco QMF, el aliasing de cada banda se cancela con el de la otra al sumar.',
    ],
    formulas: [
      { tex: 'f_{\\text{alias}} = \\left| f - k f_s \\right|, \\quad k = \\operatorname{round}(f / f_s)', caption: 'Frecuencia aparente de un tono f muestreado a fs.' },
    ],
    blocks: ['resampler', 'fir-filter', 'upsample'],
    related: ['muestreo', 'filtros'],
  },
  {
    id: 'cuantizacion',
    title: 'Cuantización y ruido de cuantización',
    aliases: ['Cuantización', 'Ruido de cuantización', 'SNR ≈ 6 dB por bit', 'Rango dinámico'],
    body: [
      'Cada muestra se redondea al nivel más cercano de una escalera de L = 2ⁿ escalones: es lo que permite escribirla con n bits. El redondeo introduce un error de, como mucho, medio escalón.',
      'Si la señal es suficientemente rica, ese error se comporta como un ruido uniforme de potencia Δ²/12. Cada bit extra divide el escalón por dos y mejora la SNR unos 6 dB. Con pocos bits el error deja de parecer ruido y se oye como distorsión.',
      'Mid-rise y mid-tread son dos formas de colocar la escalera: sin nivel en el cero o con él. La segunda deja el silencio en silencio.',
    ],
    formulas: [
      { tex: '\\Delta = \\frac{2X_{\\max}}{2^n}, \\qquad \\sigma_q^2 = \\frac{\\Delta^2}{12}', caption: 'Tamaño del escalón y potencia del ruido de cuantización.' },
      { tex: '\\mathrm{SNR}_{\\text{seno}} \\approx 6{,}02\\,n + 1{,}76\\ \\text{dB}', caption: 'SNR de una senoidal a fondo de escala con n bits.' },
    ],
    blocks: ['quantizer-uniform', 'frame-quantizer'],
    related: ['no-uniforme', 'snr', 'pcm'],
  },
  {
    id: 'no-uniforme',
    title: 'Cuantización no uniforme: ley μ y ley A',
    aliases: ['Cuantización no uniforme', 'Ley μ', 'Ley A', 'Compansión'],
    body: [
      'La voz tiene mucho más tiempo amplitudes pequeñas que grandes, y el oído percibe el ruido de forma relativa a la señal. Con escalones iguales, las partes suaves salen con muy poca SNR.',
      'La solución es comprimir la amplitud con una curva logarítmica, cuantizar de forma uniforme y expandir después (compansión). En la práctica los escalones son finos cerca de cero y anchos en los extremos, y la SNR queda casi constante en un rango dinámico de unos 40 dB.',
      'G.711 usa la ley μ (μ = 255) en Norteamérica y Japón y la ley A (A = 87,6) en Europa. Con 8 bits consigue lo que una escalera uniforme lograría con 12 o 13.',
    ],
    formulas: [
      { tex: 'F_\\mu(x) = \\operatorname{sgn}(x)\\,\\frac{\\ln(1+\\mu|x|)}{\\ln(1+\\mu)}', caption: 'Ley μ.' },
      {
        tex: 'F_A(x) = \\operatorname{sgn}(x) \\begin{cases} \\dfrac{A|x|}{1+\\ln A} & |x| < \\frac{1}{A} \\\\[6pt] \\dfrac{1+\\ln(A|x|)}{1+\\ln A} & \\frac{1}{A} \\le |x| \\le 1 \\end{cases}',
        caption: 'Ley A.',
      },
    ],
    blocks: ['quantizer-nonuniform', 'compander', 'pcm-encoder'],
    related: ['cuantizacion', 'pcm'],
  },
  {
    id: 'pcm',
    title: 'PCM y G.711',
    aliases: ['PCM', 'ITU-T G.711', 'Codificación binaria', 'Decodificación binaria'],
    body: [
      'PCM (modulación por impulsos codificados) es la forma más directa de digitalizar: muestrear, cuantizar y escribir el índice de cada escalón en binario. No comprime nada más allá de elegir fs y n.',
      'G.711 es PCM a 8 kHz con 8 bits y ley μ o A: 64 kbps. Ha sido la referencia de la telefonía digital durante décadas y todavía se usa en VoIP.',
    ],
    formulas: [{ tex: 'R = f_s \\cdot n \\quad\\Rightarrow\\quad 8000 \\cdot 8 = 64\\ \\text{kbps}', caption: 'Tasa binaria de PCM.' }],
    blocks: ['pcm-encoder', 'pcm-decoder', 'bit-packer'],
    related: ['no-uniforme', 'muestreo'],
  },
  {
    id: 'snr',
    title: 'SNR y SNR segmental',
    aliases: ['SNR', 'SNR segmental', 'Medida de calidad', 'Error', 'Suma de señales'],
    body: [
      'La relación señal/ruido compara la potencia de la señal original con la del error (la diferencia entre original y procesada). Es fácil de medir, pero la SNR global la dominan los fragmentos fuertes.',
      'La SNR segmental calcula la SNR en tramas cortas, descarta los silencios y hace la media: se parece más a lo que percibimos. Aun así, ninguna de las dos sirve para códecs que no copian la forma de onda (vocoders, perceptuales): pueden sonar bien con SNR baja.',
    ],
    formulas: [
      { tex: '\\mathrm{SNR} = 10\\log_{10}\\frac{\\sum_n x[n]^2}{\\sum_n \\left(x[n]-\\hat x[n]\\right)^2}\\ \\text{dB}', caption: 'SNR global.' },
      { tex: '\\mathrm{SNR}_{\\text{seg}} = \\frac{1}{M}\\sum_{m=1}^{M} \\mathrm{SNR}_m', caption: 'Media de la SNR de M tramas con señal.' },
    ],
    blocks: ['comparator', 'adder'],
    related: ['cuantizacion', 'perceptual'],
  },
  {
    id: 'entropia',
    title: 'Entropía',
    aliases: ['Entropía', 'Códigos de longitud variable'],
    body: [
      'La entropía mide la información media de una fuente: cuántos bits por símbolo hacen falta, como mínimo, para codificarla sin pérdidas. Una fuente con símbolos equiprobables no se puede comprimir; una muy predecible, mucho.',
      'Ningún código sin pérdidas puede bajar de la entropía en media. Huffman se queda a menos de un bit de ella; la codificación aritmética, mucho más cerca.',
    ],
    formulas: [{ tex: 'H(X) = -\\sum_i p_i \\log_2 p_i \\ \\ \\text{bits/símbolo}', caption: 'Entropía de Shannon.' }],
    blocks: ['huffman-encoder', 'arithmetic-encoder', 'pcm-encoder'],
    related: ['huffman', 'aritmetica'],
  },
  {
    id: 'huffman',
    title: 'Codificación Huffman',
    aliases: ['Huffman', 'Robustez frente a errores'],
    body: [
      'Asigna a cada símbolo un código cuya longitud depende de su probabilidad: cortos para los frecuentes, largos para los raros. Se construye uniendo una y otra vez los dos símbolos (o grupos) menos probables en un árbol.',
      'Es óptimo entre los códigos que usan un número entero de bits por símbolo, y sus códigos son prefijo: ninguno es el principio de otro, así que se pueden leer sin separadores. A cambio, un bit erróneo desalinea todo lo que sigue.',
    ],
    formulas: [
      { tex: 'H(X) \\le \\bar L = \\sum_i p_i\\, \\ell_i < H(X) + 1', caption: 'La longitud media queda a menos de 1 bit de la entropía.' },
    ],
    blocks: ['huffman-encoder', 'huffman-decoder'],
    related: ['entropia', 'aritmetica'],
  },
  {
    id: 'aritmetica',
    title: 'Codificación aritmética',
    aliases: ['Codificación aritmética', 'Intervalos'],
    body: [
      'Representa todo el mensaje con un único número en [0, 1). Empieza con el intervalo entero y, por cada símbolo, se queda con el trozo proporcional a su probabilidad. Al final basta con enviar un número que caiga dentro del intervalo final.',
      'Como no reparte bits enteros por símbolo, puede gastar fracciones: con un símbolo de probabilidad 0,97 cuesta unos 0,04 bits, cuando Huffman no baja de 1. Se usa en JPEG 2000, H.264/H.265 (CABAC) y muchos compresores modernos.',
    ],
    formulas: [
      { tex: '[\\,l_{k+1}, h_{k+1}) = [\\,l_k + (h_k - l_k)\\,F(s^-),\\ l_k + (h_k - l_k)\\,F(s)\\,)', caption: 'Estrechamiento del intervalo con la frecuencia acumulada F del símbolo s.' },
    ],
    blocks: ['arithmetic-encoder', 'arithmetic-decoder'],
    related: ['entropia', 'huffman'],
  },
  {
    id: 'lzw',
    title: 'LZW y RLE',
    aliases: ['Lempel-Ziv-Welch', 'Diccionario adaptativo', 'Compresión universal', 'RLE', 'Rachas', 'Expansión de datos'],
    body: [
      'Los compresores de diccionario no necesitan conocer las probabilidades. LZW empieza con un diccionario de símbolos sueltos y añade cada secuencia nueva que encuentra; lo que envía es el número de la secuencia conocida más larga. El receptor construye el mismo diccionario sin que se transmita.',
      'RLE (run-length) es aún más simple: sustituye cada racha de símbolos iguales por el símbolo y su longitud. Solo gana con rachas largas; con audio normal, el flujo crece.',
    ],
    formulas: [],
    blocks: ['lzw-encoder', 'rle-encoder'],
    related: ['entropia'],
  },
  {
    id: 'prediccion',
    title: 'Predicción lineal',
    aliases: ['Predicción lineal', 'Ganancia de predicción', 'Levinson-Durbin', 'Yule-Walker', 'Autocorrelación'],
    body: [
      'Las muestras de audio vecinas se parecen, así que cada una se puede estimar como combinación lineal de las anteriores. El error de esa predicción es mucho más pequeño que la señal y se puede codificar con menos bits.',
      'Los coeficientes óptimos (mínimo error cuadrático) salen de las ecuaciones de Yule-Walker, que solo dependen de la autocorrelación. Levinson-Durbin las resuelve de forma recursiva, orden a orden, y de paso da los coeficientes de reflexión.',
    ],
    formulas: [
      { tex: '\\hat x[n] = \\sum_{k=1}^{p} a_k\\, x[n-k], \\qquad e[n] = x[n] - \\hat x[n]', caption: 'Predictor de orden p y error de predicción.' },
      { tex: '\\sum_{k=1}^{p} a_k\\, r(|i-k|) = r(i), \\quad i = 1\\ldots p', caption: 'Ecuaciones de Yule-Walker.' },
      { tex: 'G_p = 10\\log_{10}\\frac{\\sigma_x^2}{\\sigma_e^2}\\ \\text{dB}', caption: 'Ganancia de predicción.' },
    ],
    blocks: ['dpcm-encoder', 'autocorrelation', 'levinson', 'lpc-encoder'],
    related: ['dpcm', 'fuente-filtro'],
  },
  {
    id: 'dpcm',
    title: 'DPCM y ADPCM',
    aliases: ['ADPCM', 'IMA ADPCM', 'ITU-T G.726', 'Cuantización adaptativa', 'Paso adaptativo de Jayant', 'Propagación de errores'],
    body: [
      'DPCM cuantiza el error de predicción en lugar de la muestra. La predicción se hace en lazo cerrado, con las muestras ya reconstruidas, para que codificador y decodificador predigan lo mismo y el error de cuantización no se acumule.',
      'ADPCM añade un cuantizador adaptativo: si los códigos salen grandes, el escalón crece; si salen pequeños, encoge. Así sigue a la señal tanto en los fragmentos fuertes como en los suaves sin enviar el escalón. G.726 transmite voz telefónica a 32 kbps, la mitad que G.711.',
      'Como cada muestra depende de las anteriores, un error de canal se arrastra un tiempo.',
    ],
    formulas: [
      { tex: '\\tilde x[n] = \\hat x[n] + Q\\big(x[n] - \\hat x[n]\\big)', caption: 'Reconstrucción en lazo cerrado.' },
      { tex: '\\Delta_{n+1} = M\\big(|c_n|\\big)\\cdot \\Delta_n', caption: 'Adaptación de Jayant: el escalón se multiplica según el último código.' },
    ],
    blocks: ['dpcm-encoder', 'adpcm-encoder', 'band-adpcm'],
    related: ['prediccion', 'cuantizacion'],
  },
  {
    id: 'tramas',
    title: 'Análisis por tramas y ventanas',
    aliases: ['Análisis por tramas', 'Ventana', 'Resolución tiempo-frecuencia', 'Solapar y sumar (overlap-add)', 'Reensamblado'],
    body: [
      'El audio cambia constantemente, pero en trozos de 10–30 ms se puede considerar estable. Casi todos los códecs trabajan así: trocean, procesan cada trama y vuelven a unir.',
      'Una trama larga da buena resolución en frecuencia y mala en tiempo; una corta, al revés. La ventana suaviza los bordes de cada trama para que el corte no añada frecuencias que no estaban. Al reconstruir, las tramas solapadas se suman (overlap-add).',
    ],
    formulas: [
      { tex: 'x_m[n] = x[n + mH]\\, w[n], \\quad n = 0\\ldots N-1', caption: 'Trama m con N muestras, avance H y ventana w.' },
      { tex: 'w_{\\text{Hann}}[n] = \\tfrac12\\left(1 - \\cos\\frac{2\\pi n}{N}\\right)', caption: 'Ventana de Hann.' },
    ],
    blocks: ['framer', 'overlap-add', 'voice-analysis'],
    related: ['fft', 'retardo'],
  },
  {
    id: 'fft',
    title: 'Transformada de Fourier y espectrograma',
    aliases: ['FFT', 'Espectrograma', 'Resolución en frecuencia', 'Dominio de la frecuencia'],
    body: [
      'La transformada discreta de Fourier descompone una trama de N muestras en N/2 frecuencias. La FFT es un algoritmo que la calcula en N·log N operaciones en lugar de N².',
      'Aplicada a tramas sucesivas da el espectrograma: tiempo en horizontal, frecuencia en vertical y energía en color. Dos tonos más cercanos que fs/N no se pueden separar.',
    ],
    formulas: [
      { tex: 'X[k] = \\sum_{n=0}^{N-1} x[n]\\, e^{-j2\\pi kn/N}', caption: 'DFT de N puntos.' },
      { tex: '\\Delta f = \\frac{f_s}{N}', caption: 'Resolución en frecuencia.' },
    ],
    blocks: ['fft'],
    related: ['tramas', 'dct'],
  },
  {
    id: 'dct',
    title: 'DCT y codificación por transformada',
    aliases: ['DCT', 'DCT inversa', 'Compactación de energía', 'Compresión por transformada', 'Umbralización', 'Cuantización por bloques', 'Factor de escala', 'MDCT', 'Pre-eco', 'Transitorios'],
    body: [
      'La DCT escribe una trama como suma de cosenos. En señales reales la energía se concentra en pocos coeficientes, así que se pueden descartar o cuantizar con pocos bits casi todos los demás: es la idea de MP3, AAC, JPEG y los códecs de vídeo.',
      'Cada bloque se cuantiza con su propio factor de escala. Si el bloque contiene un golpe brusco, el error de cuantización se reparte por todo el bloque y se oye antes del golpe: es el pre-eco, el precio de usar bloques largos. La MDCT, con bloques solapados, evita además los saltos en las fronteras.',
    ],
    formulas: [
      { tex: 'X[k] = \\sqrt{\\tfrac{2-\\delta_k}{N}}\\sum_{n=0}^{N-1} x[n]\\cos\\!\\left(\\frac{\\pi}{N}\\left(n+\\tfrac12\\right)k\\right)', caption: 'DCT-II ortonormal.' },
    ],
    blocks: ['transform-codec', 'dct', 'coef-select'],
    related: ['tramas', 'perceptual', 'retardo'],
  },
  {
    id: 'subbandas',
    title: 'Bancos de filtros y codificación en subbandas',
    aliases: ['Banco de filtros', 'Banco de filtros de síntesis', 'Banco de síntesis', 'Codificación en subbandas', 'Banco QMF', 'ITU-T G.722', 'Banda ancha', 'Interpolación'],
    body: [
      'Un banco de filtros reparte la señal en bandas de frecuencia; cada banda se diezma para no tener más muestras que al principio. Así se puede codificar cada banda con los bits que merece.',
      'El banco QMF de dos bandas está diseñado para que, al juntar las bandas, el aliasing que introdujo cada diezmado se cancele. G.722 lo usa para transmitir voz de banda ancha (hasta 7 kHz) en 64 kbps: más bits para los graves, menos para los agudos.',
    ],
    formulas: [
      { tex: 'H_1(z) = H_0(-z), \\quad F_0(z) = H_0(z), \\quad F_1(z) = -H_1(z)', caption: 'Condiciones del QMF para cancelar el aliasing.' },
    ],
    blocks: ['subband-encoder', 'mpeg-filterbank', 'fir-filter'],
    related: ['aliasing', 'perceptual'],
  },
  {
    id: 'perceptual',
    title: 'Codificación perceptual y enmascaramiento',
    aliases: ['Codificación perceptual', 'Enmascaramiento', 'Bandas críticas (Bark)', 'SMR', 'Relación ruido/máscara', 'Asignación de bits', 'MPEG-1 Audio', 'Asimetría codificador-decodificador'],
    body: [
      'Un sonido fuerte tapa a los sonidos más débiles de frecuencias cercanas: es el enmascaramiento. Además, por debajo de cierto nivel (el umbral absoluto) no oímos nada. Un códec perceptual calcula, trama a trama, cuánto ruido se puede esconder en cada banda sin que se note.',
      'La relación señal/máscara (SMR) dice cuántos dB está la señal por encima de ese umbral. Los bits se reparten para que el ruido de cuantización quede por debajo del umbral en todas las bandas. Las frecuencias se agrupan en bandas críticas, medidas en Bark, que imitan cómo el oído reparte la frecuencia.',
      'El decodificador no necesita modelo psicoacústico: solo lee los bits. Por eso los codificadores pueden mejorar sin cambiar los reproductores.',
    ],
    formulas: [
      { tex: 'z(f) = 13\\arctan(0{,}00076 f) + 3{,}5\\arctan\\!\\left(\\left(\\tfrac{f}{7500}\\right)^{2}\\right)\\ \\text{Bark}', caption: 'De hercios a la escala Bark.' },
      { tex: '\\mathrm{SMR} = L_{\\text{señal}} - L_{\\text{umbral}}, \\qquad \\mathrm{MNR} = \\mathrm{SNR}(b) - \\mathrm{SMR}', caption: 'Relación señal/máscara y ruido/máscara.' },
    ],
    blocks: ['mpeg1-encoder', 'psychoacoustic-model', 'bit-allocation'],
    related: ['subbandas', 'dct', 'snr'],
  },
  {
    id: 'fuente-filtro',
    title: 'Modelo fuente-filtro y vocoder LPC',
    aliases: ['Modelo fuente-filtro', 'Formantes', 'Envolvente espectral', 'Vocoder LPC', 'LPC-10', 'Síntesis de voz', 'Síntesis por formantes', 'Sonoras y sordas', 'Tono (F0)'],
    body: [
      'La voz se produce con una fuente (las cuerdas vocales vibrando, o aire turbulento en las consonantes sordas) que pasa por un filtro (la garganta, la boca y la nariz). Los picos de ese filtro son los formantes, los que distinguen una «a» de una «i».',
      'Un vocoder LPC no envía la onda sino el modelo: por cada trama, los coeficientes del filtro (con predicción lineal), si es sonora o sorda, el tono y la ganancia. El receptor genera pulsos o ruido y los pasa por el filtro. Se entiende con 2,4 kbps, pero suena robótico.',
    ],
    formulas: [
      { tex: 'S(z) = \\frac{G}{A(z)}\\,E(z), \\qquad A(z) = 1 - \\sum_{k=1}^{p} a_k z^{-k}', caption: 'Excitación E filtrada por el tracto vocal 1/A(z).' },
    ],
    blocks: ['lpc-encoder', 'voice-analysis', 'levinson'],
    related: ['prediccion', 'celp'],
  },
  {
    id: 'celp',
    title: 'CELP: análisis por síntesis',
    aliases: ['CELP', 'Análisis por síntesis', 'Ponderación perceptual', 'Libro adaptativo', 'Libro estocástico'],
    body: [
      'CELP mantiene el filtro LPC pero elige la excitación probando candidatos: para cada subtrama sintetiza muchos vectores de dos diccionarios y se queda con el que más se parece a la voz original. El libro adaptativo (la excitación de hace T muestras) captura el tono; el estocástico, el resto.',
      'El parecido se mide con un error ponderado que tolera más ruido en los formantes, donde el oído no lo nota. Es la base de casi todos los códecs de voz móviles (AMR, EVS) y de VoIP (G.729).',
    ],
    formulas: [
      { tex: 'u[n] = g_a\\, u[n-T] + g_s\\, c_i[n]', caption: 'Excitación: aportación adaptativa más estocástica.' },
      { tex: 'W(z) = \\frac{A(z)}{A(z/\\gamma)}, \\quad 0 < \\gamma \\le 1', caption: 'Filtro de ponderación perceptual.' },
      { tex: '(T, i) = \\arg\\min \\big\\| W(z)\\,\\big(s - \\hat s_{T,i}\\big) \\big\\|^2', caption: 'Búsqueda por análisis por síntesis.' },
    ],
    blocks: ['celp-encoder', 'celp-decoder'],
    related: ['fuente-filtro', 'prediccion'],
  },
  {
    id: 'retardo',
    title: 'Retardo algorítmico',
    aliases: ['Retardo algorítmico', 'Retardo', 'z⁻¹', 'Tiempo de paquetización'],
    body: [
      'Un códec que trabaja por tramas no puede producir nada hasta tener la trama completa, y a veces necesita mirar un poco más adelante (lookahead). Ese retardo es inevitable y se suma al de la red.',
      'En una conversación, más de unos 150 ms de retardo en un sentido empieza a molestar (ITU-T G.114). Por eso los códecs de voz usan tramas de 10–30 ms y los de música, que no son interactivos, pueden permitirse bloques más largos.',
    ],
    formulas: [{ tex: 'D = \\frac{N_{\\text{trama}} + N_{\\text{lookahead}}}{f_s}', caption: 'Retardo algorítmico de un códec por tramas.' }],
    blocks: ['transform-codec', 'packetizer', 'output'],
    related: ['tramas', 'voip'],
  },
  {
    id: 'voip',
    title: 'Voz sobre IP',
    aliases: ['VoIP', 'RTP', 'Sobrecarga de cabeceras', 'Retardo de red'],
    body: [
      'En una llamada por Internet, cada 10–30 ms de audio codificado se mete en un paquete RTP, dentro de UDP, dentro de IP. Cada capa añade su cabecera: 40 bytes con IPv4. Con códecs de baja tasa, las cabeceras pueden pesar más que el audio.',
      'Paquetes más largos ahorran cabeceras, pero añaden retardo de paquetización y cada pérdida se lleva más voz.',
    ],
    formulas: [
      { tex: 'R_{\\text{red}} = \\frac{8\\,(B_{\\text{audio}} + B_{\\text{cab}})}{T_{\\text{paquete}}}', caption: 'Tasa en la red con cabeceras.' },
    ],
    blocks: ['packetizer', 'ip-network'],
    related: ['jitter', 'retardo'],
  },
  {
    id: 'jitter',
    title: 'Jitter, pérdidas y ocultación',
    aliases: ['Jitter', 'Búfer de jitter', 'Instante de reproducción', 'Compromiso retardo-pérdidas', 'Pérdida de paquetes', 'Modelo de Gilbert', 'Ocultación de pérdidas (PLC)'],
    body: [
      'Los paquetes no tardan siempre lo mismo: esa variación es el jitter. El receptor los guarda en un búfer y los reproduce a ritmo constante; los que llegan después de su turno se tiran. Un búfer grande salva más paquetes a costa de más retardo.',
      'Las pérdidas reales suelen venir a ráfagas, que se modelan con dos estados (Gilbert). Para tapar los huecos, el receptor aplica ocultación (PLC): repetir el último paquete, interpolar o, en los códecs modernos, sintetizar algo plausible.',
    ],
    formulas: [
      { tex: 'p = \\frac{q}{q + r}, \\qquad \\bar L_{\\text{ráfaga}} = \\frac{1}{r}', caption: 'Modelo de Gilbert: tasa media de pérdidas y longitud media de ráfaga.' },
    ],
    blocks: ['ip-network', 'jitter-buffer', 'depacketizer'],
    related: ['voip'],
  },
  {
    id: 'canal',
    title: 'Errores de bit y ruido',
    aliases: ['BER', 'Canal binario simétrico', 'Ruido gaussiano'],
    body: [
      'Un canal digital puede invertir bits. La tasa de error de bit (BER) es la probabilidad de que le pase a cada uno. El daño depende del códec: en PCM un error estropea una muestra; en códecs con memoria o códigos de longitud variable, mucho más.',
      'El ruido gaussiano blanco aditivo (AWGN) es el modelo más simple de ruido analógico: se suma a la señal con una potencia fijada por la SNR.',
    ],
    formulas: [
      { tex: 'P(k \\text{ errores en } N) = \\binom{N}{k} p^k (1-p)^{N-k}', caption: 'Errores en un canal binario simétrico con BER p.' },
    ],
    blocks: ['bit-errors', 'awgn'],
    related: ['huffman', 'dpcm'],
  },
  {
    id: 'filtros',
    title: 'Filtros FIR e IIR',
    aliases: ['Filtro FIR', 'Filtros IIR', 'Fase lineal', 'Banda telefónica'],
    body: [
      'Un filtro FIR calcula cada salida como media ponderada de las últimas N entradas. Puede tener fase lineal: no deforma la onda, solo la retrasa (N−1)/2 muestras. Un IIR reutiliza también salidas anteriores: consigue cortes abruptos con muy pocos coeficientes, pero su fase no es lineal.',
      'La banda telefónica clásica deja pasar de 300 a 3400 Hz (ITU-T G.712).',
    ],
    formulas: [
      { tex: 'y[n] = \\sum_{k=0}^{N-1} h[k]\\, x[n-k]', caption: 'Filtro FIR.' },
      { tex: 'y[n] = \\sum_{k=0}^{M} b_k x[n-k] - \\sum_{k=1}^{L} a_k y[n-k]', caption: 'Filtro IIR.' },
    ],
    blocks: ['fir-filter', 'filter'],
    related: ['aliasing'],
  },
  {
    id: 'senales',
    title: 'Señales de prueba',
    aliases: ['Señales de prueba', 'DTMF', 'Concepto clave', 'Norma o algoritmo de referencia'],
    body: [
      'Las señales sintéticas son ideales para aprender porque se sabe exactamente qué contienen. Una senoidal pura deja ver el ruido de cuantización; un barrido recorre todas las frecuencias y delata el aliasing; el ruido blanco no se puede predecir ni comprimir; los transitorios (golpes) delatan el pre-eco.',
      'Los tonos DTMF del teléfono son dos senoidales por tecla, una de un grupo bajo (697–941 Hz) y otra de uno alto (1209–1477 Hz).',
    ],
    formulas: [],
    blocks: ['generator', 'sound-library'],
    related: ['muestreo'],
  },
];

/** Busca la ficha que corresponde a una etiqueta de concepto de un bloque. */
const byAlias = new Map<string, Concept>();
for (const c of concepts) for (const a of [c.title, ...c.aliases]) byAlias.set(a.toLowerCase(), c);
export const conceptFor = (label: string): Concept | undefined => byAlias.get(label.toLowerCase());
export const conceptById = (id: string): Concept | undefined => concepts.find((c) => c.id === id);
