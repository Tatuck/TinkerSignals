import { defineLesson } from '../types';

export default defineLesson({
  id: 'aritmetica-lzw',
  title: 'Aritmética y LZW',
  summary:
    'Dos ideas distintas a Huffman: un solo número para todo el mensaje, y un diccionario que se aprende solo.',
  minutes: 7,
  example: 'texto-sin-perdidas',
  topic: 'sin-perdidas',
  level: 'intermedio',
  audience: ['estudiar', 'probar'],
  order: 20,
  steps: [
    {
      text: 'La misma frase entra en tres compresores sin pérdidas: [[Huffman|n:huf]], [[aritmética|n:ari]] y [[LZW|n:lzw]]. Mira la compresión de cada uno: con una frase tan corta, **ninguno comprime**. Lo que envían para que el decodificador entienda los códigos (la tabla de frecuencias, la cabecera) pesa más que lo que ahorran.',
      focus: { nodes: ['huf', 'ari', 'lzw'] },
    },
    {
      text: '[[La codificación aritmética|n:ari]] reparte $[0, 1)$ entre los símbolos según su probabilidad y, con cada símbolo, se queda con su trozo. Abre «Cómo se estrecha el intervalo» y pulsa **Paso a paso**.',
      node: 'ari',
      theory: 'aritmetica',
    },
    {
      text: 'Al final basta con enviar un número cualquiera del último intervalo. Su anchura es el producto de las probabilidades, así que hacen falta unos $-\\log_2 \\prod p_i$ bits: justo la información del mensaje.',
      predict: {
        question: '¿Cuál de los tres necesita enviar las frecuencias de los símbolos?',
        options: ['Huffman y aritmética', 'Solo LZW', 'Ninguno'],
        answer: 0,
        explain:
          'Huffman y aritmética (estáticos) necesitan que el decodificador conozca el modelo, así que lo envían al principio. LZW no: el decodificador **reconstruye el diccionario** a partir de los códigos.',
      },
    },
    {
      text: '[[LZW|n:lzw]] no cuenta frecuencias: va guardando las secuencias que ya ha visto y envía el número de la más larga que conoce. Abre «El diccionario, paso a paso».',
      node: 'lzw',
      theory: 'lzw',
    },
    {
      text: 'Con un texto largo la cabecera pesa poco y los tres comprimen. LZW, además, mejora cuanto más repetitivo es el texto.',
      node: 'src',
      param: 'text',
      task: 'Escribe un texto de más de 200 caracteres con frases repetidas.',
      check: (c) => (c.metric('src', 'characters') ?? 0) > 200,
    },
    {
      text: 'Mira [[cuántos símbolos lleva cada código de LZW|m:lzw.symbolsPerCode]]: crece a medida que el diccionario aprende, y con frases repetidas LZW acaba ganando a Huffman y a la aritmética, que solo miran la frecuencia de cada letra por separado. GIF usa LZW; ZIP y PNG, su primo LZ77.',
      node: 'lzw',
    },
  ],
});
