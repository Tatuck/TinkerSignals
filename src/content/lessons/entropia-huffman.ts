import { defineLesson } from '../types';

export default defineLesson({
  id: 'entropia-huffman',
  title: 'Entropía y Huffman',
  summary: 'Cuántos bits hacen falta de verdad, y cómo se acerca Huffman a ese mínimo.',
  minutes: 6,
  example: 'texto-huffman',
  topic: 'sin-perdidas',
  level: 'basico',
  audience: ['estudiar', 'curiosear'],
  order: 10,
  steps: [
    {
      text: '[[El texto|n:src]] sale con 8 bits por carácter. Pero no todas las letras aparecen igual: en esta frase hay muchas «t» y «r» y ninguna «z». ¿Hacen falta los 8 bits?',
      node: 'src',
      theory: 'entropia',
    },
    {
      text: 'La **entropía** $H = -\\sum p_i \\log_2 p_i$ es el mínimo de bits por símbolo para un código que codifique cada carácter por separado.',
      predict: {
        question: '¿Cuánto crees que vale la entropía de esta frase?',
        options: ['8 bits, como ahora', 'Entre 3 y 4 bits', 'Menos de 1 bit'],
        answer: 1,
        explain:
          'Mira [[la entropía del texto|m:src.entropy]]: ronda los 3,5 bits. Más de la mitad de los 8 bits que se envían sin comprimir son redundantes.',
      },
    },
    {
      text: '[[Huffman|n:huf]] da códigos cortos a los caracteres frecuentes y largos a los raros, sin que ninguno sea el principio de otro. Abre su «Tabla de códigos» y mira [[la longitud media|m:huf.avgLength]]: queda muy cerca de la entropía.',
      node: 'huf',
      theory: 'huffman',
    },
    {
      text: 'Prueba con un mensaje casi sin sorpresa.',
      node: 'src',
      param: 'text',
      task: 'Escribe en el texto algo muy repetitivo, como «AAAAAAAAAB».',
      check: (c) => (c.metric('src', 'entropy') ?? 8) < 1,
    },
    {
      text: 'Ahora [[la entropía|m:src.entropy]] es menor que 1 bit por carácter.',
      predict: {
        question: '¿Cuánto será la longitud media de Huffman?',
        options: ['Casi 0, como la entropía', 'Exactamente 1 bit por carácter', 'Más de 2 bits'],
        answer: 1,
        explain:
          'Huffman da un número **entero** de bits a cada símbolo: nunca baja de 1. Es su límite; la [[codificación aritmética|c:aritmetica]] sí puede bajar de 1 bit por símbolo.',
      },
    },
    {
      text: 'Y [[el decodificador|n:hd,view]] recupera el texto exacto: es compresión **sin pérdidas**.',
      focus: { nodes: ['hd', 'view'] },
    },
  ],
});
