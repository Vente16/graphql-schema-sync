import { ApolloLink, Observable } from '@apollo/client/core';
import type { DocumentNode } from 'graphql';
import {
  buildSkippedOperationData,
  extractOperationContext
} from './adapt-document.js';
import { padOperationResponse } from './pad-response.js';

export interface EnvironmentCompatHelpers {
  adaptDocumentForEnvironment: (
    document: DocumentNode,
    environment: string
  ) => {
    document: DocumentNode;
    removedRootFields: string[];
  };
  filterOperationArgs: (
    environment: string,
    parentType: 'Query' | 'Mutation' | 'Subscription',
    fieldName: string,
    args: Record<string, unknown>
  ) => Record<string, unknown>;
  typeFieldAvailability: Record<string, Record<string, readonly string[]>>;
}

function padResult(
  helpers: EnvironmentCompatHelpers,
  originalQuery: DocumentNode,
  data: unknown,
  environment: string,
  operationName?: string
): Record<string, unknown> {
  return padOperationResponse({
    document: originalQuery,
    data,
    environment,
    operationName,
    typeFieldAvailability: helpers.typeFieldAvailability ?? {}
  });
}

export interface CreateEnvironmentCompatLinkOptions {
  getEnvironment: () => string;
  helpers: EnvironmentCompatHelpers;
  onSkippedOperation?: (details: {
    environment: string;
    removedRootFields: string[];
    operationName?: string;
  }) => void;
}

export function createEnvironmentCompatLink(
  options: CreateEnvironmentCompatLinkOptions
): ApolloLink {
  const { getEnvironment, helpers, onSkippedOperation } = options;

  if (!helpers.typeFieldAvailability) {
    console.warn(
      '[graphql-schema-sync] Pass environmentCompatHelpers from generated defaults.ts. ' +
        'Without typeFieldAvailability, Apollo cache error 13 ("Missing field … while writing result") ' +
        'will occur when switching to staging.'
    );
  }

  return new ApolloLink((operation, forward) => {
    const environment = getEnvironment();
    const originalQuery = operation.query;
    const { document, removedRootFields } = helpers.adaptDocumentForEnvironment(
      originalQuery,
      environment
    );

    const context = extractOperationContext(document);
    const allRootFieldsRemoved =
      removedRootFields.length > 0 &&
      (!context ||
        removedRootFields.includes(context.fieldName) ||
        !document.definitions.some(
          definition =>
            definition.kind === 'OperationDefinition' &&
            definition.selectionSet?.selections.length
        ));

    if (allRootFieldsRemoved) {
      onSkippedOperation?.({
        environment,
        removedRootFields,
        operationName: operation.operationName
      });

      return new Observable(observer => {
        observer.next({
          data: buildSkippedOperationData(removedRootFields)
        });
        observer.complete();
      });
    }

    operation.query = document;

    if (context && operation.variables) {
      operation.variables = helpers.filterOperationArgs(
        environment,
        context.parentType,
        context.fieldName,
        operation.variables as Record<string, unknown>
      );
    }

    return new Observable(observer => {
      const subscription = forward(operation).subscribe({
        next: result => {
          operation.query = originalQuery;

          if (!result.data) {
            observer.next(result);
            return;
          }

          observer.next({
            ...result,
            data: padResult(
              helpers,
              originalQuery,
              result.data,
              environment,
              operation.operationName
            )
          });
        },
        error: error => observer.error(error),
        complete: () => observer.complete()
      });

      return () => subscription.unsubscribe();
    });
  });
}
