import PathProxy from '../../src/PathProxy';
import ExecuteQueryHandler from '../../src/ExecuteQueryHandler';
import SparqlHandler from '../../src/SparqlHandler';
import PathExpressionHandler from '../../src/PathExpressionHandler';
import InsertFunctionHandler from '../../src/InsertFunctionHandler';
import DeleteFunctionHandler from '../../src/DeleteFunctionHandler';
import ReplaceFunctionHandler from '../../src/ReplaceFunctionHandler';
import SubjectsHandler from '../../src/SubjectsHandler';
import SetFunctionHandler from '../../src/SetFunctionHandler';
import DataHandler from '../../src/DataHandler';
import JSONLDResolver from '../../src/JSONLDResolver';
import { createQueryEngine, deindent } from '../util';
import { namedNode, literal } from '@rdfjs/data-model';

import context from '../context';

const subject = namedNode('https://example.org/#me');
const queryEngine = createQueryEngine([
  literal('Alice'),
  literal('Bob'),
  literal('Carol'),
]);

const resolvers = [
  new JSONLDResolver(context),
];
const handlersPath = {
  sparql: new SparqlHandler(),
  pathExpression: new PathExpressionHandler(),
  results: new ExecuteQueryHandler(),
  [Symbol.asyncIterator]: {
    handle(pathData, path) {
      return () => path.results[Symbol.asyncIterator]();
    },
  },
  toString: DataHandler.syncFunction('subject', 'value'),
};

const handlersMutation = {
  sparql: new SparqlHandler(),
  pathExpression: new PathExpressionHandler(),
  results: new ExecuteQueryHandler(),
  [Symbol.asyncIterator]: {
    handle(pathData, path) {
      return () => path.results[Symbol.asyncIterator]();
    },
  },
  add: new InsertFunctionHandler(),
  delete: new DeleteFunctionHandler(),
  replace: new ReplaceFunctionHandler(),
  set: new SetFunctionHandler(),
  toString: DataHandler.syncFunction('subject', 'value'),
};

describe('a query path with a path expression handler', () => {
  let person;
  beforeAll(() => {
    const pathProxy = new PathProxy({ handlers: handlersPath, resolvers });
    person = pathProxy.createPath({ queryEngine }, { subject });
  });

  it('returns results for a path with 3 links', async () => {
    const names = [];
    for await (const firstName of person.friends.firstName)
      names.push(firstName);
    expect(names.map(n => `${n}`)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('returns results for nested expression calls', async () => {
    const names = [];
    for await (const friend of person.friends) {
      for await (const firstName of friend.friends.firstName)
        names.push(firstName);
    }
    expect(names.map(n => `${n}`)).toEqual(['Alice', 'Bob', 'Carol', 'Alice', 'Bob', 'Carol', 'Alice', 'Bob', 'Carol']);
  });
});

describe('a query path with a subjects handler', () => {
  let person;
  beforeAll(() => {
    const pathProxy = new PathProxy({ handlers: { ...handlersPath, subjects: new SubjectsHandler() }, resolvers });
    person = pathProxy.createPath({ queryEngine }, { subject });
  });

  it('returns results, with executeQuery being called with the right query', async () => {
    const subjects = [];
    for await (const subj of person.subjects)
      subjects.push(subj);
    expect(queryEngine.execute).toBeCalledWith(deindent(`
      SELECT DISTINCT ?subject WHERE {
        ?subject ?predicate ?object.
      }`));
    expect(subjects.map(s => `${s}`)).toEqual(['Alice', 'Bob', 'Carol']);
  });
});

describe('a query path with a path and mutation expression handler', () => {
  let person;
  beforeAll(() => {
    const pathProxy = new PathProxy({ handlers: handlersMutation, resolvers });
    person = pathProxy.createPath({ queryEngine }, { subject });
  });

  it('returns results for a path with 3 links', async () => {
    const names = [];
    for await (const firstName of person.friends.firstName)
      names.push(firstName);
    expect(names.map(n => `${n}`)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('returns true for an addition with 3 links', async () => {
    expect(await person.friends.firstName.add('Ruben')).toBeTruthy();
  });

  it('returns true for an set with 3 links', async () => {
    expect(await person.friends.firstName.set('Ruben')).toBeTruthy();
  });

  it('returns true for an replace with 3 links', async () => {
    expect(await person.friends.firstName.set('ruben', 'Ruben')).toBeTruthy();
  });
});
