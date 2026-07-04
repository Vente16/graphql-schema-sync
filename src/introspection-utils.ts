import type {
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionType,
  IntrospectionTypeRef
} from 'graphql';

type NamedIntrospectionType = Extract<
  IntrospectionType,
  {
    kind: 'OBJECT' | 'INTERFACE' | 'INPUT_OBJECT' | 'ENUM' | 'UNION' | 'SCALAR';
  }
>;

export function isNamedType(
  type: IntrospectionType
): type is NamedIntrospectionType {
  return (
    type.kind === 'OBJECT' ||
    type.kind === 'INTERFACE' ||
    type.kind === 'INPUT_OBJECT' ||
    type.kind === 'ENUM' ||
    type.kind === 'UNION' ||
    type.kind === 'SCALAR'
  );
}

export function isInternalTypeName(name: string): boolean {
  return name.startsWith('__');
}

export function typeRefToSdl(
  type: IntrospectionTypeRef,
  options: { forceNullable?: boolean } = {}
): string {
  const { forceNullable = false } = options;

  if (type.kind === 'NON_NULL') {
    if (forceNullable && type.ofType) {
      return typeRefToSdl(type.ofType, options);
    }
    return `${typeRefToSdl(type.ofType!, options)}!`;
  }

  if (type.kind === 'LIST') {
    return `[${typeRefToSdl(type.ofType!, options)}]`;
  }

  return type.name ?? 'Unknown';
}

export function isRequiredType(type: IntrospectionTypeRef): boolean {
  return type.kind === 'NON_NULL';
}

export function makeNullableSdl(typeSdl: string): string {
  return typeSdl.endsWith('!') ? typeSdl.slice(0, -1) : typeSdl;
}

export function getFieldKey(parentType: string, fieldName: string): string {
  return `${parentType}.${fieldName}`;
}

export function getInputFieldKey(
  parentType: string,
  fieldName: string
): string {
  return `${parentType}.${fieldName}`;
}

export function formatDefaultValue(
  value: string | null | undefined
): string | null {
  if (value == null) {
    return null;
  }
  return value;
}

export function getObjectFields(
  type: Extract<IntrospectionType, { kind: 'OBJECT' | 'INTERFACE' }>
): readonly IntrospectionField[] {
  return type.fields ?? [];
}

export function getInputFields(
  type: Extract<IntrospectionType, { kind: 'INPUT_OBJECT' }>
): readonly IntrospectionInputValue[] {
  return type.inputFields ?? [];
}
