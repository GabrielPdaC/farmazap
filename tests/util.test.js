// node --test tests
// Dados fictícios; a estrutura das linhas imita a tabela "Últimas Retiradas"
// observada no G-MUS (bloco "Nº/Data/Dias", cabeçalho, itens).
const test = require('node:test');
const assert = require('node:assert/strict');
const FZ = require('../src/shared/util.js');

test('normalizarTelefone', () => {
  assert.equal(FZ.normalizarTelefone('(51) 99999-8888'), '5551999998888');
  assert.equal(FZ.normalizarTelefone('51 3333-4444'), '555133334444');
  assert.equal(FZ.normalizarTelefone('+55 51 99999-8888'), '5551999998888');
  assert.equal(FZ.normalizarTelefone('055 51 99999-8888'), '5551999998888');
  assert.equal(FZ.normalizarTelefone('(55) 99999-8888'), '5555999998888'); // DDD 55 (RS)
  assert.equal(FZ.normalizarTelefone('99999-8888'), null);                 // sem DDD
  assert.equal(FZ.normalizarTelefone(''), null);
});

test('extrairTelefones só pega números rotulados e prioriza celular', () => {
  const texto = 'CPF: 12345678901\nCNS: 700000000000000\nTelefone: (51) 3333-4444\nCelular: (51) 99999-8888\n';
  const tels = FZ.extrairTelefones(texto);
  assert.deepEqual(tels.map((t) => t.numero), ['5551999998888', '555133334444']);
  assert.equal(FZ.extrairTelefones('CPF: 12345678901').length, 0);
});

const LINHAS = [
  ['Nº: 500001       Data: 03/11/2026    Dias: 30    UPS: FARMACIA MUNICIPAL'],
  ['Material/Medicamento', 'Lote', 'Validade', 'Qtd Baixa', 'Qtd Devolvida', 'Prescrito', 'Duração', 'Término', 'Receita', 'Observação'],
  ['LOSARTANA 50MG COMP (123.4)', 'L123', '01/01/2028', '30', '0', '30', '30', '03/12/2026', '', ''],
  ['METFORMINA 850MG COMP (456.7)', 'L456', '01/06/2028', '60', '0', '60', '45', '18/12/2026', '', ''],
  ['DIPIRONA 500MG (789.0)', 'L789', '01/06/2028', '10', '10', '10', '5', '08/11/2026', '', ''],
  ['Nº: 970001       Data: 01/10/2026    Dias: 30'],
  ['Material/Medicamento', 'Lote', 'Validade', 'Qtd Baixa', 'Qtd Devolvida', 'Prescrito', 'Duração', 'Término', 'Receita', 'Observação'],
  ['LOSARTANA 50MG COMP (123.4)', 'L100', '01/01/2028', '30', '0', '30', '30', '31/10/2026', '', '']
];

test('parseUltimasRetiradas separa blocos e lê término por item', () => {
  const blocos = FZ.parseUltimasRetiradas(LINHAS);
  assert.equal(blocos.length, 2);
  assert.equal(blocos[0].numero, '500001');
  assert.equal(blocos[0].data, '03/11/2026');
  assert.equal(blocos[0].itens.length, 3);
  assert.equal(blocos[0].itens[1].termino, '18/12/2026');
  assert.equal(blocos[0].itens[1].duracao, '45');
  assert.equal(blocos[0].itens[2].devolvido, true);
  assert.equal(blocos[1].itens[0].termino, '31/10/2026');
});

test('parseUltimasRetiradas tolera acentos quebrados (ISO-8859-1 lido como UTF-8)', () => {
  const quebradas = LINHAS.map((l) => l.map((c) => c.replace('º', '�').replace('ç', '�').replace('ã', '�').replace('é', '�')));
  const blocos = FZ.parseUltimasRetiradas(quebradas);
  assert.equal(blocos[0].numero, '500001');
  assert.equal(blocos[0].itens[0].termino, '03/12/2026');
});

test('escolherBloco', () => {
  const blocos = FZ.parseUltimasRetiradas(LINHAS);
  assert.equal(FZ.escolherBloco(blocos, '970001').bloco.numero, '970001');
  const r = FZ.escolherBloco(blocos, '999999');
  assert.equal(r.exato, false);
  assert.equal(r.bloco.numero, '500001');
});

test('nomes', () => {
  assert.equal(FZ.nomePacienteLimpo('MARIA DA SILVA (123456) - Sexo: Feminino'), 'MARIA DA SILVA');
  assert.equal(FZ.capitalizarNome('MARIA DA SILVA'), 'Maria da Silva');
  assert.equal(FZ.primeiroNome('MARIA DA SILVA'), 'Maria');
  assert.equal(FZ.nomeMedicamento('LOSARTANA 50MG COMP (123.4)'), 'LOSARTANA 50MG COMP');
});

test('montarMensagem ordena por término e preenche variáveis', () => {
  const msg = FZ.montarMensagem({}, {
    nome: 'MARIA DA SILVA',
    itens: [
      { material: 'METFORMINA 850MG (1)', termino: '18/12/2026' },
      { material: 'LOSARTANA 50MG (2)', termino: '03/12/2026' }
    ]
  });
  assert.match(msg, /^Olá, Maria!/);
  assert.ok(msg.indexOf('LOSARTANA') < msg.indexOf('METFORMINA'));
  assert.match(msg, /• LOSARTANA 50MG — até \*03\/12\/2026\*/);
  assert.ok(!msg.includes('{'));
});

test('montarMensagem sem nome não deixa "Olá, !"', () => {
  const msg = FZ.montarMensagem({}, { nome: '', itens: [{ material: 'X', termino: '01/01/2027' }] });
  assert.match(msg, /^Olá! /);
});
