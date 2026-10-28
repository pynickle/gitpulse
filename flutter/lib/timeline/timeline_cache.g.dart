// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'timeline_cache.dart';

// ignore_for_file: type=lint
class CacheAccount extends Table
    with TableInfo<CacheAccount, CacheAccountData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  CacheAccount(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _scopeMeta = const VerificationMeta('scope');
  late final GeneratedColumn<String> scope = GeneratedColumn<String>(
    'scope',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL PRIMARY KEY',
  );
  static const VerificationMeta _retentionDaysMeta = const VerificationMeta(
    'retentionDays',
  );
  late final GeneratedColumn<int> retentionDays = GeneratedColumn<int>(
    'retention_days',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    $customConstraints: '',
  );
  static const VerificationMeta _savedAtMeta = const VerificationMeta(
    'savedAt',
  );
  late final GeneratedColumn<int> savedAt = GeneratedColumn<int>(
    'saved_at',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    $customConstraints: '',
  );
  static const VerificationMeta _lowerBoundMeta = const VerificationMeta(
    'lowerBound',
  );
  late final GeneratedColumn<int> lowerBound = GeneratedColumn<int>(
    'lower_bound',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    $customConstraints: '',
  );
  static const VerificationMeta _baselineMeta = const VerificationMeta(
    'baseline',
  );
  late final GeneratedColumn<String> baseline = GeneratedColumn<String>(
    'baseline',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    $customConstraints: '',
  );
  static const VerificationMeta _pendingFollowsMeta = const VerificationMeta(
    'pendingFollows',
  );
  late final GeneratedColumn<String> pendingFollows = GeneratedColumn<String>(
    'pending_follows',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    $customConstraints: '',
  );
  static const VerificationMeta _partialMeta = const VerificationMeta(
    'partial',
  );
  late final GeneratedColumn<int> partial = GeneratedColumn<int>(
    'partial',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    $customConstraints: 'NOT NULL DEFAULT 0',
    defaultValue: const CustomExpression('0'),
  );
  @override
  List<GeneratedColumn> get $columns => [
    scope,
    retentionDays,
    savedAt,
    lowerBound,
    baseline,
    pendingFollows,
    partial,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_account';
  @override
  VerificationContext validateIntegrity(
    Insertable<CacheAccountData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('scope')) {
      context.handle(
        _scopeMeta,
        scope.isAcceptableOrUnknown(data['scope']!, _scopeMeta),
      );
    } else if (isInserting) {
      context.missing(_scopeMeta);
    }
    if (data.containsKey('retention_days')) {
      context.handle(
        _retentionDaysMeta,
        retentionDays.isAcceptableOrUnknown(
          data['retention_days']!,
          _retentionDaysMeta,
        ),
      );
    }
    if (data.containsKey('saved_at')) {
      context.handle(
        _savedAtMeta,
        savedAt.isAcceptableOrUnknown(data['saved_at']!, _savedAtMeta),
      );
    }
    if (data.containsKey('lower_bound')) {
      context.handle(
        _lowerBoundMeta,
        lowerBound.isAcceptableOrUnknown(data['lower_bound']!, _lowerBoundMeta),
      );
    }
    if (data.containsKey('baseline')) {
      context.handle(
        _baselineMeta,
        baseline.isAcceptableOrUnknown(data['baseline']!, _baselineMeta),
      );
    }
    if (data.containsKey('pending_follows')) {
      context.handle(
        _pendingFollowsMeta,
        pendingFollows.isAcceptableOrUnknown(
          data['pending_follows']!,
          _pendingFollowsMeta,
        ),
      );
    }
    if (data.containsKey('partial')) {
      context.handle(
        _partialMeta,
        partial.isAcceptableOrUnknown(data['partial']!, _partialMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {scope};
  @override
  CacheAccountData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheAccountData(
      scope: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}scope'],
      )!,
      retentionDays: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retention_days'],
      ),
      savedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}saved_at'],
      ),
      lowerBound: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}lower_bound'],
      ),
      baseline: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}baseline'],
      ),
      pendingFollows: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pending_follows'],
      ),
      partial: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}partial'],
      )!,
    );
  }

  @override
  CacheAccount createAlias(String alias) {
    return CacheAccount(attachedDatabase, alias);
  }

  @override
  bool get dontWriteConstraints => true;
}

class CacheAccountData extends DataClass
    implements Insertable<CacheAccountData> {
  final String scope;
  final int? retentionDays;
  final int? savedAt;
  final int? lowerBound;
  final String? baseline;
  final String? pendingFollows;
  final int partial;
  const CacheAccountData({
    required this.scope,
    this.retentionDays,
    this.savedAt,
    this.lowerBound,
    this.baseline,
    this.pendingFollows,
    required this.partial,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['scope'] = Variable<String>(scope);
    if (!nullToAbsent || retentionDays != null) {
      map['retention_days'] = Variable<int>(retentionDays);
    }
    if (!nullToAbsent || savedAt != null) {
      map['saved_at'] = Variable<int>(savedAt);
    }
    if (!nullToAbsent || lowerBound != null) {
      map['lower_bound'] = Variable<int>(lowerBound);
    }
    if (!nullToAbsent || baseline != null) {
      map['baseline'] = Variable<String>(baseline);
    }
    if (!nullToAbsent || pendingFollows != null) {
      map['pending_follows'] = Variable<String>(pendingFollows);
    }
    map['partial'] = Variable<int>(partial);
    return map;
  }

  CacheAccountCompanion toCompanion(bool nullToAbsent) {
    return CacheAccountCompanion(
      scope: Value(scope),
      retentionDays: retentionDays == null && nullToAbsent
          ? const Value.absent()
          : Value(retentionDays),
      savedAt: savedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(savedAt),
      lowerBound: lowerBound == null && nullToAbsent
          ? const Value.absent()
          : Value(lowerBound),
      baseline: baseline == null && nullToAbsent
          ? const Value.absent()
          : Value(baseline),
      pendingFollows: pendingFollows == null && nullToAbsent
          ? const Value.absent()
          : Value(pendingFollows),
      partial: Value(partial),
    );
  }

  factory CacheAccountData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheAccountData(
      scope: serializer.fromJson<String>(json['scope']),
      retentionDays: serializer.fromJson<int?>(json['retention_days']),
      savedAt: serializer.fromJson<int?>(json['saved_at']),
      lowerBound: serializer.fromJson<int?>(json['lower_bound']),
      baseline: serializer.fromJson<String?>(json['baseline']),
      pendingFollows: serializer.fromJson<String?>(json['pending_follows']),
      partial: serializer.fromJson<int>(json['partial']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'scope': serializer.toJson<String>(scope),
      'retention_days': serializer.toJson<int?>(retentionDays),
      'saved_at': serializer.toJson<int?>(savedAt),
      'lower_bound': serializer.toJson<int?>(lowerBound),
      'baseline': serializer.toJson<String?>(baseline),
      'pending_follows': serializer.toJson<String?>(pendingFollows),
      'partial': serializer.toJson<int>(partial),
    };
  }

  CacheAccountData copyWith({
    String? scope,
    Value<int?> retentionDays = const Value.absent(),
    Value<int?> savedAt = const Value.absent(),
    Value<int?> lowerBound = const Value.absent(),
    Value<String?> baseline = const Value.absent(),
    Value<String?> pendingFollows = const Value.absent(),
    int? partial,
  }) => CacheAccountData(
    scope: scope ?? this.scope,
    retentionDays: retentionDays.present
        ? retentionDays.value
        : this.retentionDays,
    savedAt: savedAt.present ? savedAt.value : this.savedAt,
    lowerBound: lowerBound.present ? lowerBound.value : this.lowerBound,
    baseline: baseline.present ? baseline.value : this.baseline,
    pendingFollows: pendingFollows.present
        ? pendingFollows.value
        : this.pendingFollows,
    partial: partial ?? this.partial,
  );
  CacheAccountData copyWithCompanion(CacheAccountCompanion data) {
    return CacheAccountData(
      scope: data.scope.present ? data.scope.value : this.scope,
      retentionDays: data.retentionDays.present
          ? data.retentionDays.value
          : this.retentionDays,
      savedAt: data.savedAt.present ? data.savedAt.value : this.savedAt,
      lowerBound: data.lowerBound.present
          ? data.lowerBound.value
          : this.lowerBound,
      baseline: data.baseline.present ? data.baseline.value : this.baseline,
      pendingFollows: data.pendingFollows.present
          ? data.pendingFollows.value
          : this.pendingFollows,
      partial: data.partial.present ? data.partial.value : this.partial,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheAccountData(')
          ..write('scope: $scope, ')
          ..write('retentionDays: $retentionDays, ')
          ..write('savedAt: $savedAt, ')
          ..write('lowerBound: $lowerBound, ')
          ..write('baseline: $baseline, ')
          ..write('pendingFollows: $pendingFollows, ')
          ..write('partial: $partial')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    scope,
    retentionDays,
    savedAt,
    lowerBound,
    baseline,
    pendingFollows,
    partial,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheAccountData &&
          other.scope == this.scope &&
          other.retentionDays == this.retentionDays &&
          other.savedAt == this.savedAt &&
          other.lowerBound == this.lowerBound &&
          other.baseline == this.baseline &&
          other.pendingFollows == this.pendingFollows &&
          other.partial == this.partial);
}

class CacheAccountCompanion extends UpdateCompanion<CacheAccountData> {
  final Value<String> scope;
  final Value<int?> retentionDays;
  final Value<int?> savedAt;
  final Value<int?> lowerBound;
  final Value<String?> baseline;
  final Value<String?> pendingFollows;
  final Value<int> partial;
  final Value<int> rowid;
  const CacheAccountCompanion({
    this.scope = const Value.absent(),
    this.retentionDays = const Value.absent(),
    this.savedAt = const Value.absent(),
    this.lowerBound = const Value.absent(),
    this.baseline = const Value.absent(),
    this.pendingFollows = const Value.absent(),
    this.partial = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CacheAccountCompanion.insert({
    required String scope,
    this.retentionDays = const Value.absent(),
    this.savedAt = const Value.absent(),
    this.lowerBound = const Value.absent(),
    this.baseline = const Value.absent(),
    this.pendingFollows = const Value.absent(),
    this.partial = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : scope = Value(scope);
  static Insertable<CacheAccountData> custom({
    Expression<String>? scope,
    Expression<int>? retentionDays,
    Expression<int>? savedAt,
    Expression<int>? lowerBound,
    Expression<String>? baseline,
    Expression<String>? pendingFollows,
    Expression<int>? partial,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (scope != null) 'scope': scope,
      if (retentionDays != null) 'retention_days': retentionDays,
      if (savedAt != null) 'saved_at': savedAt,
      if (lowerBound != null) 'lower_bound': lowerBound,
      if (baseline != null) 'baseline': baseline,
      if (pendingFollows != null) 'pending_follows': pendingFollows,
      if (partial != null) 'partial': partial,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CacheAccountCompanion copyWith({
    Value<String>? scope,
    Value<int?>? retentionDays,
    Value<int?>? savedAt,
    Value<int?>? lowerBound,
    Value<String?>? baseline,
    Value<String?>? pendingFollows,
    Value<int>? partial,
    Value<int>? rowid,
  }) {
    return CacheAccountCompanion(
      scope: scope ?? this.scope,
      retentionDays: retentionDays ?? this.retentionDays,
      savedAt: savedAt ?? this.savedAt,
      lowerBound: lowerBound ?? this.lowerBound,
      baseline: baseline ?? this.baseline,
      pendingFollows: pendingFollows ?? this.pendingFollows,
      partial: partial ?? this.partial,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (scope.present) {
      map['scope'] = Variable<String>(scope.value);
    }
    if (retentionDays.present) {
      map['retention_days'] = Variable<int>(retentionDays.value);
    }
    if (savedAt.present) {
      map['saved_at'] = Variable<int>(savedAt.value);
    }
    if (lowerBound.present) {
      map['lower_bound'] = Variable<int>(lowerBound.value);
    }
    if (baseline.present) {
      map['baseline'] = Variable<String>(baseline.value);
    }
    if (pendingFollows.present) {
      map['pending_follows'] = Variable<String>(pendingFollows.value);
    }
    if (partial.present) {
      map['partial'] = Variable<int>(partial.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheAccountCompanion(')
          ..write('scope: $scope, ')
          ..write('retentionDays: $retentionDays, ')
          ..write('savedAt: $savedAt, ')
          ..write('lowerBound: $lowerBound, ')
          ..write('baseline: $baseline, ')
          ..write('pendingFollows: $pendingFollows, ')
          ..write('partial: $partial, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class CacheRepositories extends Table
    with TableInfo<CacheRepositories, CacheRepository> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  CacheRepositories(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL PRIMARY KEY',
  );
  static const VerificationMeta _ownerMeta = const VerificationMeta('owner');
  late final GeneratedColumn<String> owner = GeneratedColumn<String>(
    'owner',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  @override
  List<GeneratedColumn> get $columns => [id, owner, name];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_repositories';
  @override
  VerificationContext validateIntegrity(
    Insertable<CacheRepository> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('owner')) {
      context.handle(
        _ownerMeta,
        owner.isAcceptableOrUnknown(data['owner']!, _ownerMeta),
      );
    } else if (isInserting) {
      context.missing(_ownerMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CacheRepository map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheRepository(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      owner: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}owner'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
    );
  }

  @override
  CacheRepositories createAlias(String alias) {
    return CacheRepositories(attachedDatabase, alias);
  }

  @override
  bool get dontWriteConstraints => true;
}

class CacheRepository extends DataClass implements Insertable<CacheRepository> {
  final String id;
  final String owner;
  final String name;
  const CacheRepository({
    required this.id,
    required this.owner,
    required this.name,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['owner'] = Variable<String>(owner);
    map['name'] = Variable<String>(name);
    return map;
  }

  CacheRepositoriesCompanion toCompanion(bool nullToAbsent) {
    return CacheRepositoriesCompanion(
      id: Value(id),
      owner: Value(owner),
      name: Value(name),
    );
  }

  factory CacheRepository.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheRepository(
      id: serializer.fromJson<String>(json['id']),
      owner: serializer.fromJson<String>(json['owner']),
      name: serializer.fromJson<String>(json['name']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'owner': serializer.toJson<String>(owner),
      'name': serializer.toJson<String>(name),
    };
  }

  CacheRepository copyWith({String? id, String? owner, String? name}) =>
      CacheRepository(
        id: id ?? this.id,
        owner: owner ?? this.owner,
        name: name ?? this.name,
      );
  CacheRepository copyWithCompanion(CacheRepositoriesCompanion data) {
    return CacheRepository(
      id: data.id.present ? data.id.value : this.id,
      owner: data.owner.present ? data.owner.value : this.owner,
      name: data.name.present ? data.name.value : this.name,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheRepository(')
          ..write('id: $id, ')
          ..write('owner: $owner, ')
          ..write('name: $name')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, owner, name);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheRepository &&
          other.id == this.id &&
          other.owner == this.owner &&
          other.name == this.name);
}

class CacheRepositoriesCompanion extends UpdateCompanion<CacheRepository> {
  final Value<String> id;
  final Value<String> owner;
  final Value<String> name;
  final Value<int> rowid;
  const CacheRepositoriesCompanion({
    this.id = const Value.absent(),
    this.owner = const Value.absent(),
    this.name = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CacheRepositoriesCompanion.insert({
    required String id,
    required String owner,
    required String name,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       owner = Value(owner),
       name = Value(name);
  static Insertable<CacheRepository> custom({
    Expression<String>? id,
    Expression<String>? owner,
    Expression<String>? name,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (owner != null) 'owner': owner,
      if (name != null) 'name': name,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CacheRepositoriesCompanion copyWith({
    Value<String>? id,
    Value<String>? owner,
    Value<String>? name,
    Value<int>? rowid,
  }) {
    return CacheRepositoriesCompanion(
      id: id ?? this.id,
      owner: owner ?? this.owner,
      name: name ?? this.name,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (owner.present) {
      map['owner'] = Variable<String>(owner.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheRepositoriesCompanion(')
          ..write('id: $id, ')
          ..write('owner: $owner, ')
          ..write('name: $name, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class CacheReleases extends Table with TableInfo<CacheReleases, CacheRelease> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  CacheReleases(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _repositoryIdMeta = const VerificationMeta(
    'repositoryId',
  );
  late final GeneratedColumn<String> repositoryId = GeneratedColumn<String>(
    'repository_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _publishedAtMeta = const VerificationMeta(
    'publishedAt',
  );
  late final GeneratedColumn<int> publishedAt = GeneratedColumn<int>(
    'published_at',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _contentMeta = const VerificationMeta(
    'content',
  );
  late final GeneratedColumn<String> content = GeneratedColumn<String>(
    'content',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  @override
  List<GeneratedColumn> get $columns => [
    repositoryId,
    id,
    publishedAt,
    content,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_releases';
  @override
  VerificationContext validateIntegrity(
    Insertable<CacheRelease> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('repository_id')) {
      context.handle(
        _repositoryIdMeta,
        repositoryId.isAcceptableOrUnknown(
          data['repository_id']!,
          _repositoryIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_repositoryIdMeta);
    }
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('published_at')) {
      context.handle(
        _publishedAtMeta,
        publishedAt.isAcceptableOrUnknown(
          data['published_at']!,
          _publishedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_publishedAtMeta);
    }
    if (data.containsKey('content')) {
      context.handle(
        _contentMeta,
        content.isAcceptableOrUnknown(data['content']!, _contentMeta),
      );
    } else if (isInserting) {
      context.missing(_contentMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {repositoryId, id};
  @override
  CacheRelease map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheRelease(
      repositoryId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}repository_id'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      publishedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}published_at'],
      )!,
      content: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}content'],
      )!,
    );
  }

  @override
  CacheReleases createAlias(String alias) {
    return CacheReleases(attachedDatabase, alias);
  }

  @override
  List<String> get customConstraints => const [
    'PRIMARY KEY(repository_id, id)',
  ];
  @override
  bool get dontWriteConstraints => true;
}

class CacheRelease extends DataClass implements Insertable<CacheRelease> {
  final String repositoryId;
  final int id;
  final int publishedAt;
  final String content;
  const CacheRelease({
    required this.repositoryId,
    required this.id,
    required this.publishedAt,
    required this.content,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['repository_id'] = Variable<String>(repositoryId);
    map['id'] = Variable<int>(id);
    map['published_at'] = Variable<int>(publishedAt);
    map['content'] = Variable<String>(content);
    return map;
  }

  CacheReleasesCompanion toCompanion(bool nullToAbsent) {
    return CacheReleasesCompanion(
      repositoryId: Value(repositoryId),
      id: Value(id),
      publishedAt: Value(publishedAt),
      content: Value(content),
    );
  }

  factory CacheRelease.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheRelease(
      repositoryId: serializer.fromJson<String>(json['repository_id']),
      id: serializer.fromJson<int>(json['id']),
      publishedAt: serializer.fromJson<int>(json['published_at']),
      content: serializer.fromJson<String>(json['content']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'repository_id': serializer.toJson<String>(repositoryId),
      'id': serializer.toJson<int>(id),
      'published_at': serializer.toJson<int>(publishedAt),
      'content': serializer.toJson<String>(content),
    };
  }

  CacheRelease copyWith({
    String? repositoryId,
    int? id,
    int? publishedAt,
    String? content,
  }) => CacheRelease(
    repositoryId: repositoryId ?? this.repositoryId,
    id: id ?? this.id,
    publishedAt: publishedAt ?? this.publishedAt,
    content: content ?? this.content,
  );
  CacheRelease copyWithCompanion(CacheReleasesCompanion data) {
    return CacheRelease(
      repositoryId: data.repositoryId.present
          ? data.repositoryId.value
          : this.repositoryId,
      id: data.id.present ? data.id.value : this.id,
      publishedAt: data.publishedAt.present
          ? data.publishedAt.value
          : this.publishedAt,
      content: data.content.present ? data.content.value : this.content,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheRelease(')
          ..write('repositoryId: $repositoryId, ')
          ..write('id: $id, ')
          ..write('publishedAt: $publishedAt, ')
          ..write('content: $content')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(repositoryId, id, publishedAt, content);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheRelease &&
          other.repositoryId == this.repositoryId &&
          other.id == this.id &&
          other.publishedAt == this.publishedAt &&
          other.content == this.content);
}

class CacheReleasesCompanion extends UpdateCompanion<CacheRelease> {
  final Value<String> repositoryId;
  final Value<int> id;
  final Value<int> publishedAt;
  final Value<String> content;
  final Value<int> rowid;
  const CacheReleasesCompanion({
    this.repositoryId = const Value.absent(),
    this.id = const Value.absent(),
    this.publishedAt = const Value.absent(),
    this.content = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CacheReleasesCompanion.insert({
    required String repositoryId,
    required int id,
    required int publishedAt,
    required String content,
    this.rowid = const Value.absent(),
  }) : repositoryId = Value(repositoryId),
       id = Value(id),
       publishedAt = Value(publishedAt),
       content = Value(content);
  static Insertable<CacheRelease> custom({
    Expression<String>? repositoryId,
    Expression<int>? id,
    Expression<int>? publishedAt,
    Expression<String>? content,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (repositoryId != null) 'repository_id': repositoryId,
      if (id != null) 'id': id,
      if (publishedAt != null) 'published_at': publishedAt,
      if (content != null) 'content': content,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CacheReleasesCompanion copyWith({
    Value<String>? repositoryId,
    Value<int>? id,
    Value<int>? publishedAt,
    Value<String>? content,
    Value<int>? rowid,
  }) {
    return CacheReleasesCompanion(
      repositoryId: repositoryId ?? this.repositoryId,
      id: id ?? this.id,
      publishedAt: publishedAt ?? this.publishedAt,
      content: content ?? this.content,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (repositoryId.present) {
      map['repository_id'] = Variable<String>(repositoryId.value);
    }
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (publishedAt.present) {
      map['published_at'] = Variable<int>(publishedAt.value);
    }
    if (content.present) {
      map['content'] = Variable<String>(content.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheReleasesCompanion(')
          ..write('repositoryId: $repositoryId, ')
          ..write('id: $id, ')
          ..write('publishedAt: $publishedAt, ')
          ..write('content: $content, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class CacheSegments extends Table with TableInfo<CacheSegments, CacheSegment> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  CacheSegments(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    $customConstraints: 'NOT NULL PRIMARY KEY AUTOINCREMENT',
  );
  static const VerificationMeta _repositoryIdMeta = const VerificationMeta(
    'repositoryId',
  );
  late final GeneratedColumn<String> repositoryId = GeneratedColumn<String>(
    'repository_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _cycleMeta = const VerificationMeta('cycle');
  late final GeneratedColumn<String> cycle = GeneratedColumn<String>(
    'cycle',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _requestCursorMeta = const VerificationMeta(
    'requestCursor',
  );
  late final GeneratedColumn<String> requestCursor = GeneratedColumn<String>(
    'request_cursor',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    $customConstraints: '',
  );
  static const VerificationMeta _endCursorMeta = const VerificationMeta(
    'endCursor',
  );
  late final GeneratedColumn<String> endCursor = GeneratedColumn<String>(
    'end_cursor',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    $customConstraints: '',
  );
  static const VerificationMeta _hasOlderMeta = const VerificationMeta(
    'hasOlder',
  );
  late final GeneratedColumn<int> hasOlder = GeneratedColumn<int>(
    'has_older',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _incompleteMeta = const VerificationMeta(
    'incomplete',
  );
  late final GeneratedColumn<int> incomplete = GeneratedColumn<int>(
    'incomplete',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    repositoryId,
    cycle,
    requestCursor,
    endCursor,
    hasOlder,
    incomplete,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_segments';
  @override
  VerificationContext validateIntegrity(
    Insertable<CacheSegment> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('repository_id')) {
      context.handle(
        _repositoryIdMeta,
        repositoryId.isAcceptableOrUnknown(
          data['repository_id']!,
          _repositoryIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_repositoryIdMeta);
    }
    if (data.containsKey('cycle')) {
      context.handle(
        _cycleMeta,
        cycle.isAcceptableOrUnknown(data['cycle']!, _cycleMeta),
      );
    } else if (isInserting) {
      context.missing(_cycleMeta);
    }
    if (data.containsKey('request_cursor')) {
      context.handle(
        _requestCursorMeta,
        requestCursor.isAcceptableOrUnknown(
          data['request_cursor']!,
          _requestCursorMeta,
        ),
      );
    }
    if (data.containsKey('end_cursor')) {
      context.handle(
        _endCursorMeta,
        endCursor.isAcceptableOrUnknown(data['end_cursor']!, _endCursorMeta),
      );
    }
    if (data.containsKey('has_older')) {
      context.handle(
        _hasOlderMeta,
        hasOlder.isAcceptableOrUnknown(data['has_older']!, _hasOlderMeta),
      );
    } else if (isInserting) {
      context.missing(_hasOlderMeta);
    }
    if (data.containsKey('incomplete')) {
      context.handle(
        _incompleteMeta,
        incomplete.isAcceptableOrUnknown(data['incomplete']!, _incompleteMeta),
      );
    } else if (isInserting) {
      context.missing(_incompleteMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CacheSegment map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheSegment(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      repositoryId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}repository_id'],
      )!,
      cycle: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}cycle'],
      )!,
      requestCursor: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}request_cursor'],
      ),
      endCursor: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}end_cursor'],
      ),
      hasOlder: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}has_older'],
      )!,
      incomplete: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}incomplete'],
      )!,
    );
  }

  @override
  CacheSegments createAlias(String alias) {
    return CacheSegments(attachedDatabase, alias);
  }

  @override
  bool get dontWriteConstraints => true;
}

class CacheSegment extends DataClass implements Insertable<CacheSegment> {
  final int id;
  final String repositoryId;
  final String cycle;
  final String? requestCursor;
  final String? endCursor;
  final int hasOlder;
  final int incomplete;
  const CacheSegment({
    required this.id,
    required this.repositoryId,
    required this.cycle,
    this.requestCursor,
    this.endCursor,
    required this.hasOlder,
    required this.incomplete,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['repository_id'] = Variable<String>(repositoryId);
    map['cycle'] = Variable<String>(cycle);
    if (!nullToAbsent || requestCursor != null) {
      map['request_cursor'] = Variable<String>(requestCursor);
    }
    if (!nullToAbsent || endCursor != null) {
      map['end_cursor'] = Variable<String>(endCursor);
    }
    map['has_older'] = Variable<int>(hasOlder);
    map['incomplete'] = Variable<int>(incomplete);
    return map;
  }

  CacheSegmentsCompanion toCompanion(bool nullToAbsent) {
    return CacheSegmentsCompanion(
      id: Value(id),
      repositoryId: Value(repositoryId),
      cycle: Value(cycle),
      requestCursor: requestCursor == null && nullToAbsent
          ? const Value.absent()
          : Value(requestCursor),
      endCursor: endCursor == null && nullToAbsent
          ? const Value.absent()
          : Value(endCursor),
      hasOlder: Value(hasOlder),
      incomplete: Value(incomplete),
    );
  }

  factory CacheSegment.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheSegment(
      id: serializer.fromJson<int>(json['id']),
      repositoryId: serializer.fromJson<String>(json['repository_id']),
      cycle: serializer.fromJson<String>(json['cycle']),
      requestCursor: serializer.fromJson<String?>(json['request_cursor']),
      endCursor: serializer.fromJson<String?>(json['end_cursor']),
      hasOlder: serializer.fromJson<int>(json['has_older']),
      incomplete: serializer.fromJson<int>(json['incomplete']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'repository_id': serializer.toJson<String>(repositoryId),
      'cycle': serializer.toJson<String>(cycle),
      'request_cursor': serializer.toJson<String?>(requestCursor),
      'end_cursor': serializer.toJson<String?>(endCursor),
      'has_older': serializer.toJson<int>(hasOlder),
      'incomplete': serializer.toJson<int>(incomplete),
    };
  }

  CacheSegment copyWith({
    int? id,
    String? repositoryId,
    String? cycle,
    Value<String?> requestCursor = const Value.absent(),
    Value<String?> endCursor = const Value.absent(),
    int? hasOlder,
    int? incomplete,
  }) => CacheSegment(
    id: id ?? this.id,
    repositoryId: repositoryId ?? this.repositoryId,
    cycle: cycle ?? this.cycle,
    requestCursor: requestCursor.present
        ? requestCursor.value
        : this.requestCursor,
    endCursor: endCursor.present ? endCursor.value : this.endCursor,
    hasOlder: hasOlder ?? this.hasOlder,
    incomplete: incomplete ?? this.incomplete,
  );
  CacheSegment copyWithCompanion(CacheSegmentsCompanion data) {
    return CacheSegment(
      id: data.id.present ? data.id.value : this.id,
      repositoryId: data.repositoryId.present
          ? data.repositoryId.value
          : this.repositoryId,
      cycle: data.cycle.present ? data.cycle.value : this.cycle,
      requestCursor: data.requestCursor.present
          ? data.requestCursor.value
          : this.requestCursor,
      endCursor: data.endCursor.present ? data.endCursor.value : this.endCursor,
      hasOlder: data.hasOlder.present ? data.hasOlder.value : this.hasOlder,
      incomplete: data.incomplete.present
          ? data.incomplete.value
          : this.incomplete,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheSegment(')
          ..write('id: $id, ')
          ..write('repositoryId: $repositoryId, ')
          ..write('cycle: $cycle, ')
          ..write('requestCursor: $requestCursor, ')
          ..write('endCursor: $endCursor, ')
          ..write('hasOlder: $hasOlder, ')
          ..write('incomplete: $incomplete')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    repositoryId,
    cycle,
    requestCursor,
    endCursor,
    hasOlder,
    incomplete,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheSegment &&
          other.id == this.id &&
          other.repositoryId == this.repositoryId &&
          other.cycle == this.cycle &&
          other.requestCursor == this.requestCursor &&
          other.endCursor == this.endCursor &&
          other.hasOlder == this.hasOlder &&
          other.incomplete == this.incomplete);
}

class CacheSegmentsCompanion extends UpdateCompanion<CacheSegment> {
  final Value<int> id;
  final Value<String> repositoryId;
  final Value<String> cycle;
  final Value<String?> requestCursor;
  final Value<String?> endCursor;
  final Value<int> hasOlder;
  final Value<int> incomplete;
  const CacheSegmentsCompanion({
    this.id = const Value.absent(),
    this.repositoryId = const Value.absent(),
    this.cycle = const Value.absent(),
    this.requestCursor = const Value.absent(),
    this.endCursor = const Value.absent(),
    this.hasOlder = const Value.absent(),
    this.incomplete = const Value.absent(),
  });
  CacheSegmentsCompanion.insert({
    this.id = const Value.absent(),
    required String repositoryId,
    required String cycle,
    this.requestCursor = const Value.absent(),
    this.endCursor = const Value.absent(),
    required int hasOlder,
    required int incomplete,
  }) : repositoryId = Value(repositoryId),
       cycle = Value(cycle),
       hasOlder = Value(hasOlder),
       incomplete = Value(incomplete);
  static Insertable<CacheSegment> custom({
    Expression<int>? id,
    Expression<String>? repositoryId,
    Expression<String>? cycle,
    Expression<String>? requestCursor,
    Expression<String>? endCursor,
    Expression<int>? hasOlder,
    Expression<int>? incomplete,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (repositoryId != null) 'repository_id': repositoryId,
      if (cycle != null) 'cycle': cycle,
      if (requestCursor != null) 'request_cursor': requestCursor,
      if (endCursor != null) 'end_cursor': endCursor,
      if (hasOlder != null) 'has_older': hasOlder,
      if (incomplete != null) 'incomplete': incomplete,
    });
  }

  CacheSegmentsCompanion copyWith({
    Value<int>? id,
    Value<String>? repositoryId,
    Value<String>? cycle,
    Value<String?>? requestCursor,
    Value<String?>? endCursor,
    Value<int>? hasOlder,
    Value<int>? incomplete,
  }) {
    return CacheSegmentsCompanion(
      id: id ?? this.id,
      repositoryId: repositoryId ?? this.repositoryId,
      cycle: cycle ?? this.cycle,
      requestCursor: requestCursor ?? this.requestCursor,
      endCursor: endCursor ?? this.endCursor,
      hasOlder: hasOlder ?? this.hasOlder,
      incomplete: incomplete ?? this.incomplete,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (repositoryId.present) {
      map['repository_id'] = Variable<String>(repositoryId.value);
    }
    if (cycle.present) {
      map['cycle'] = Variable<String>(cycle.value);
    }
    if (requestCursor.present) {
      map['request_cursor'] = Variable<String>(requestCursor.value);
    }
    if (endCursor.present) {
      map['end_cursor'] = Variable<String>(endCursor.value);
    }
    if (hasOlder.present) {
      map['has_older'] = Variable<int>(hasOlder.value);
    }
    if (incomplete.present) {
      map['incomplete'] = Variable<int>(incomplete.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheSegmentsCompanion(')
          ..write('id: $id, ')
          ..write('repositoryId: $repositoryId, ')
          ..write('cycle: $cycle, ')
          ..write('requestCursor: $requestCursor, ')
          ..write('endCursor: $endCursor, ')
          ..write('hasOlder: $hasOlder, ')
          ..write('incomplete: $incomplete')
          ..write(')'))
        .toString();
  }
}

class CachePageMembers extends Table
    with TableInfo<CachePageMembers, CachePageMember> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  CachePageMembers(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _segmentIdMeta = const VerificationMeta(
    'segmentId',
  );
  late final GeneratedColumn<int> segmentId = GeneratedColumn<int>(
    'segment_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _repositoryIdMeta = const VerificationMeta(
    'repositoryId',
  );
  late final GeneratedColumn<String> repositoryId = GeneratedColumn<String>(
    'repository_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _releaseIdMeta = const VerificationMeta(
    'releaseId',
  );
  late final GeneratedColumn<int> releaseId = GeneratedColumn<int>(
    'release_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  @override
  List<GeneratedColumn> get $columns => [segmentId, repositoryId, releaseId];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_page_members';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachePageMember> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('segment_id')) {
      context.handle(
        _segmentIdMeta,
        segmentId.isAcceptableOrUnknown(data['segment_id']!, _segmentIdMeta),
      );
    } else if (isInserting) {
      context.missing(_segmentIdMeta);
    }
    if (data.containsKey('repository_id')) {
      context.handle(
        _repositoryIdMeta,
        repositoryId.isAcceptableOrUnknown(
          data['repository_id']!,
          _repositoryIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_repositoryIdMeta);
    }
    if (data.containsKey('release_id')) {
      context.handle(
        _releaseIdMeta,
        releaseId.isAcceptableOrUnknown(data['release_id']!, _releaseIdMeta),
      );
    } else if (isInserting) {
      context.missing(_releaseIdMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {segmentId, repositoryId, releaseId};
  @override
  CachePageMember map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachePageMember(
      segmentId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}segment_id'],
      )!,
      repositoryId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}repository_id'],
      )!,
      releaseId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}release_id'],
      )!,
    );
  }

  @override
  CachePageMembers createAlias(String alias) {
    return CachePageMembers(attachedDatabase, alias);
  }

  @override
  List<String> get customConstraints => const [
    'PRIMARY KEY(segment_id, repository_id, release_id)',
  ];
  @override
  bool get dontWriteConstraints => true;
}

class CachePageMember extends DataClass implements Insertable<CachePageMember> {
  final int segmentId;
  final String repositoryId;
  final int releaseId;
  const CachePageMember({
    required this.segmentId,
    required this.repositoryId,
    required this.releaseId,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['segment_id'] = Variable<int>(segmentId);
    map['repository_id'] = Variable<String>(repositoryId);
    map['release_id'] = Variable<int>(releaseId);
    return map;
  }

  CachePageMembersCompanion toCompanion(bool nullToAbsent) {
    return CachePageMembersCompanion(
      segmentId: Value(segmentId),
      repositoryId: Value(repositoryId),
      releaseId: Value(releaseId),
    );
  }

  factory CachePageMember.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachePageMember(
      segmentId: serializer.fromJson<int>(json['segment_id']),
      repositoryId: serializer.fromJson<String>(json['repository_id']),
      releaseId: serializer.fromJson<int>(json['release_id']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'segment_id': serializer.toJson<int>(segmentId),
      'repository_id': serializer.toJson<String>(repositoryId),
      'release_id': serializer.toJson<int>(releaseId),
    };
  }

  CachePageMember copyWith({
    int? segmentId,
    String? repositoryId,
    int? releaseId,
  }) => CachePageMember(
    segmentId: segmentId ?? this.segmentId,
    repositoryId: repositoryId ?? this.repositoryId,
    releaseId: releaseId ?? this.releaseId,
  );
  CachePageMember copyWithCompanion(CachePageMembersCompanion data) {
    return CachePageMember(
      segmentId: data.segmentId.present ? data.segmentId.value : this.segmentId,
      repositoryId: data.repositoryId.present
          ? data.repositoryId.value
          : this.repositoryId,
      releaseId: data.releaseId.present ? data.releaseId.value : this.releaseId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachePageMember(')
          ..write('segmentId: $segmentId, ')
          ..write('repositoryId: $repositoryId, ')
          ..write('releaseId: $releaseId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(segmentId, repositoryId, releaseId);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachePageMember &&
          other.segmentId == this.segmentId &&
          other.repositoryId == this.repositoryId &&
          other.releaseId == this.releaseId);
}

class CachePageMembersCompanion extends UpdateCompanion<CachePageMember> {
  final Value<int> segmentId;
  final Value<String> repositoryId;
  final Value<int> releaseId;
  final Value<int> rowid;
  const CachePageMembersCompanion({
    this.segmentId = const Value.absent(),
    this.repositoryId = const Value.absent(),
    this.releaseId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachePageMembersCompanion.insert({
    required int segmentId,
    required String repositoryId,
    required int releaseId,
    this.rowid = const Value.absent(),
  }) : segmentId = Value(segmentId),
       repositoryId = Value(repositoryId),
       releaseId = Value(releaseId);
  static Insertable<CachePageMember> custom({
    Expression<int>? segmentId,
    Expression<String>? repositoryId,
    Expression<int>? releaseId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (segmentId != null) 'segment_id': segmentId,
      if (repositoryId != null) 'repository_id': repositoryId,
      if (releaseId != null) 'release_id': releaseId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachePageMembersCompanion copyWith({
    Value<int>? segmentId,
    Value<String>? repositoryId,
    Value<int>? releaseId,
    Value<int>? rowid,
  }) {
    return CachePageMembersCompanion(
      segmentId: segmentId ?? this.segmentId,
      repositoryId: repositoryId ?? this.repositoryId,
      releaseId: releaseId ?? this.releaseId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (segmentId.present) {
      map['segment_id'] = Variable<int>(segmentId.value);
    }
    if (repositoryId.present) {
      map['repository_id'] = Variable<String>(repositoryId.value);
    }
    if (releaseId.present) {
      map['release_id'] = Variable<int>(releaseId.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachePageMembersCompanion(')
          ..write('segmentId: $segmentId, ')
          ..write('repositoryId: $repositoryId, ')
          ..write('releaseId: $releaseId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class CacheVisible extends Table
    with TableInfo<CacheVisible, CacheVisibleData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  CacheVisible(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _repositoryIdMeta = const VerificationMeta(
    'repositoryId',
  );
  late final GeneratedColumn<String> repositoryId = GeneratedColumn<String>(
    'repository_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _releaseIdMeta = const VerificationMeta(
    'releaseId',
  );
  late final GeneratedColumn<int> releaseId = GeneratedColumn<int>(
    'release_id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  static const VerificationMeta _oldestShownMeta = const VerificationMeta(
    'oldestShown',
  );
  late final GeneratedColumn<int> oldestShown = GeneratedColumn<int>(
    'oldest_shown',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
    $customConstraints: 'NOT NULL',
  );
  @override
  List<GeneratedColumn> get $columns => [repositoryId, releaseId, oldestShown];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_visible';
  @override
  VerificationContext validateIntegrity(
    Insertable<CacheVisibleData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('repository_id')) {
      context.handle(
        _repositoryIdMeta,
        repositoryId.isAcceptableOrUnknown(
          data['repository_id']!,
          _repositoryIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_repositoryIdMeta);
    }
    if (data.containsKey('release_id')) {
      context.handle(
        _releaseIdMeta,
        releaseId.isAcceptableOrUnknown(data['release_id']!, _releaseIdMeta),
      );
    } else if (isInserting) {
      context.missing(_releaseIdMeta);
    }
    if (data.containsKey('oldest_shown')) {
      context.handle(
        _oldestShownMeta,
        oldestShown.isAcceptableOrUnknown(
          data['oldest_shown']!,
          _oldestShownMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_oldestShownMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {repositoryId, releaseId};
  @override
  CacheVisibleData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheVisibleData(
      repositoryId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}repository_id'],
      )!,
      releaseId: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}release_id'],
      )!,
      oldestShown: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}oldest_shown'],
      )!,
    );
  }

  @override
  CacheVisible createAlias(String alias) {
    return CacheVisible(attachedDatabase, alias);
  }

  @override
  List<String> get customConstraints => const [
    'PRIMARY KEY(repository_id, release_id)',
  ];
  @override
  bool get dontWriteConstraints => true;
}

class CacheVisibleData extends DataClass
    implements Insertable<CacheVisibleData> {
  final String repositoryId;
  final int releaseId;
  final int oldestShown;
  const CacheVisibleData({
    required this.repositoryId,
    required this.releaseId,
    required this.oldestShown,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['repository_id'] = Variable<String>(repositoryId);
    map['release_id'] = Variable<int>(releaseId);
    map['oldest_shown'] = Variable<int>(oldestShown);
    return map;
  }

  CacheVisibleCompanion toCompanion(bool nullToAbsent) {
    return CacheVisibleCompanion(
      repositoryId: Value(repositoryId),
      releaseId: Value(releaseId),
      oldestShown: Value(oldestShown),
    );
  }

  factory CacheVisibleData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheVisibleData(
      repositoryId: serializer.fromJson<String>(json['repository_id']),
      releaseId: serializer.fromJson<int>(json['release_id']),
      oldestShown: serializer.fromJson<int>(json['oldest_shown']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'repository_id': serializer.toJson<String>(repositoryId),
      'release_id': serializer.toJson<int>(releaseId),
      'oldest_shown': serializer.toJson<int>(oldestShown),
    };
  }

  CacheVisibleData copyWith({
    String? repositoryId,
    int? releaseId,
    int? oldestShown,
  }) => CacheVisibleData(
    repositoryId: repositoryId ?? this.repositoryId,
    releaseId: releaseId ?? this.releaseId,
    oldestShown: oldestShown ?? this.oldestShown,
  );
  CacheVisibleData copyWithCompanion(CacheVisibleCompanion data) {
    return CacheVisibleData(
      repositoryId: data.repositoryId.present
          ? data.repositoryId.value
          : this.repositoryId,
      releaseId: data.releaseId.present ? data.releaseId.value : this.releaseId,
      oldestShown: data.oldestShown.present
          ? data.oldestShown.value
          : this.oldestShown,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheVisibleData(')
          ..write('repositoryId: $repositoryId, ')
          ..write('releaseId: $releaseId, ')
          ..write('oldestShown: $oldestShown')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(repositoryId, releaseId, oldestShown);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheVisibleData &&
          other.repositoryId == this.repositoryId &&
          other.releaseId == this.releaseId &&
          other.oldestShown == this.oldestShown);
}

class CacheVisibleCompanion extends UpdateCompanion<CacheVisibleData> {
  final Value<String> repositoryId;
  final Value<int> releaseId;
  final Value<int> oldestShown;
  final Value<int> rowid;
  const CacheVisibleCompanion({
    this.repositoryId = const Value.absent(),
    this.releaseId = const Value.absent(),
    this.oldestShown = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CacheVisibleCompanion.insert({
    required String repositoryId,
    required int releaseId,
    required int oldestShown,
    this.rowid = const Value.absent(),
  }) : repositoryId = Value(repositoryId),
       releaseId = Value(releaseId),
       oldestShown = Value(oldestShown);
  static Insertable<CacheVisibleData> custom({
    Expression<String>? repositoryId,
    Expression<int>? releaseId,
    Expression<int>? oldestShown,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (repositoryId != null) 'repository_id': repositoryId,
      if (releaseId != null) 'release_id': releaseId,
      if (oldestShown != null) 'oldest_shown': oldestShown,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CacheVisibleCompanion copyWith({
    Value<String>? repositoryId,
    Value<int>? releaseId,
    Value<int>? oldestShown,
    Value<int>? rowid,
  }) {
    return CacheVisibleCompanion(
      repositoryId: repositoryId ?? this.repositoryId,
      releaseId: releaseId ?? this.releaseId,
      oldestShown: oldestShown ?? this.oldestShown,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (repositoryId.present) {
      map['repository_id'] = Variable<String>(repositoryId.value);
    }
    if (releaseId.present) {
      map['release_id'] = Variable<int>(releaseId.value);
    }
    if (oldestShown.present) {
      map['oldest_shown'] = Variable<int>(oldestShown.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheVisibleCompanion(')
          ..write('repositoryId: $repositoryId, ')
          ..write('releaseId: $releaseId, ')
          ..write('oldestShown: $oldestShown, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$TimelineCache extends GeneratedDatabase {
  _$TimelineCache(QueryExecutor e) : super(e);
  $TimelineCacheManager get managers => $TimelineCacheManager(this);
  late final CacheAccount cacheAccount = CacheAccount(this);
  late final CacheRepositories cacheRepositories = CacheRepositories(this);
  late final CacheReleases cacheReleases = CacheReleases(this);
  late final Index cacheReleasesPublishedAt = Index(
    'cache_releases_published_at',
    'CREATE INDEX cache_releases_published_at ON cache_releases (published_at)',
  );
  late final CacheSegments cacheSegments = CacheSegments(this);
  late final Index cacheSegmentsRepositoryCycleCursor = Index(
    'cache_segments_repository_cycle_cursor',
    'CREATE INDEX cache_segments_repository_cycle_cursor ON cache_segments (repository_id, cycle, request_cursor)',
  );
  late final CachePageMembers cachePageMembers = CachePageMembers(this);
  late final CacheVisible cacheVisible = CacheVisible(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    cacheAccount,
    cacheRepositories,
    cacheReleases,
    cacheReleasesPublishedAt,
    cacheSegments,
    cacheSegmentsRepositoryCycleCursor,
    cachePageMembers,
    cacheVisible,
  ];
}

typedef $CacheAccountCreateCompanionBuilder = CacheAccountCompanion Function({
  required String scope,
  Value<int?> retentionDays,
  Value<int?> savedAt,
  Value<int?> lowerBound,
  Value<String?> baseline,
  Value<String?> pendingFollows,
  Value<int> partial,
  Value<int> rowid,
});
typedef $CacheAccountUpdateCompanionBuilder = CacheAccountCompanion Function({
  Value<String> scope,
  Value<int?> retentionDays,
  Value<int?> savedAt,
  Value<int?> lowerBound,
  Value<String?> baseline,
  Value<String?> pendingFollows,
  Value<int> partial,
  Value<int> rowid,
});

class $CacheAccountFilterComposer
    extends Composer<_$TimelineCache, CacheAccount> {
  $CacheAccountFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get scope => $composableBuilder(
    column: $table.scope,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retentionDays => $composableBuilder(
    column: $table.retentionDays,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get savedAt => $composableBuilder(
    column: $table.savedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get lowerBound => $composableBuilder(
    column: $table.lowerBound,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get baseline => $composableBuilder(
    column: $table.baseline,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get pendingFollows => $composableBuilder(
    column: $table.pendingFollows,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get partial => $composableBuilder(
    column: $table.partial,
    builder: (column) => ColumnFilters(column),
  );
}

class $CacheAccountOrderingComposer
    extends Composer<_$TimelineCache, CacheAccount> {
  $CacheAccountOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get scope => $composableBuilder(
    column: $table.scope,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retentionDays => $composableBuilder(
    column: $table.retentionDays,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get savedAt => $composableBuilder(
    column: $table.savedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get lowerBound => $composableBuilder(
    column: $table.lowerBound,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get baseline => $composableBuilder(
    column: $table.baseline,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get pendingFollows => $composableBuilder(
    column: $table.pendingFollows,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get partial => $composableBuilder(
    column: $table.partial,
    builder: (column) => ColumnOrderings(column),
  );
}

class $CacheAccountAnnotationComposer
    extends Composer<_$TimelineCache, CacheAccount> {
  $CacheAccountAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get scope =>
      $composableBuilder(column: $table.scope, builder: (column) => column);

  GeneratedColumn<int> get retentionDays => $composableBuilder(
    column: $table.retentionDays,
    builder: (column) => column,
  );

  GeneratedColumn<int> get savedAt =>
      $composableBuilder(column: $table.savedAt, builder: (column) => column);

  GeneratedColumn<int> get lowerBound => $composableBuilder(
    column: $table.lowerBound,
    builder: (column) => column,
  );

  GeneratedColumn<String> get baseline =>
      $composableBuilder(column: $table.baseline, builder: (column) => column);

  GeneratedColumn<String> get pendingFollows => $composableBuilder(
    column: $table.pendingFollows,
    builder: (column) => column,
  );

  GeneratedColumn<int> get partial =>
      $composableBuilder(column: $table.partial, builder: (column) => column);
}

class $CacheAccountTableManager
    extends
        RootTableManager<
          _$TimelineCache,
          CacheAccount,
          CacheAccountData,
          $CacheAccountFilterComposer,
          $CacheAccountOrderingComposer,
          $CacheAccountAnnotationComposer,
          $CacheAccountCreateCompanionBuilder,
          $CacheAccountUpdateCompanionBuilder,
          (
            CacheAccountData,
            BaseReferences<_$TimelineCache, CacheAccount, CacheAccountData>,
          ),
          CacheAccountData,
          PrefetchHooks Function()
        > {
  $CacheAccountTableManager(_$TimelineCache db, CacheAccount table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $CacheAccountFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $CacheAccountOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $CacheAccountAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> scope = const Value.absent(),
                Value<int?> retentionDays = const Value.absent(),
                Value<int?> savedAt = const Value.absent(),
                Value<int?> lowerBound = const Value.absent(),
                Value<String?> baseline = const Value.absent(),
                Value<String?> pendingFollows = const Value.absent(),
                Value<int> partial = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CacheAccountCompanion(
                scope: scope,
                retentionDays: retentionDays,
                savedAt: savedAt,
                lowerBound: lowerBound,
                baseline: baseline,
                pendingFollows: pendingFollows,
                partial: partial,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String scope,
                Value<int?> retentionDays = const Value.absent(),
                Value<int?> savedAt = const Value.absent(),
                Value<int?> lowerBound = const Value.absent(),
                Value<String?> baseline = const Value.absent(),
                Value<String?> pendingFollows = const Value.absent(),
                Value<int> partial = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CacheAccountCompanion.insert(
                scope: scope,
                retentionDays: retentionDays,
                savedAt: savedAt,
                lowerBound: lowerBound,
                baseline: baseline,
                pendingFollows: pendingFollows,
                partial: partial,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<CacheAccount, CacheAccountData>(table),
                  BaseReferences<
                    _$TimelineCache,
                    CacheAccount,
                    CacheAccountData
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $CacheAccountProcessedTableManager =
    ProcessedTableManager<
      _$TimelineCache,
      CacheAccount,
      CacheAccountData,
      $CacheAccountFilterComposer,
      $CacheAccountOrderingComposer,
      $CacheAccountAnnotationComposer,
      $CacheAccountCreateCompanionBuilder,
      $CacheAccountUpdateCompanionBuilder,
      (
        CacheAccountData,
        BaseReferences<_$TimelineCache, CacheAccount, CacheAccountData>,
      ),
      CacheAccountData,
      PrefetchHooks Function()
    >;
typedef $CacheRepositoriesCreateCompanionBuilder =
    CacheRepositoriesCompanion Function({
      required String id,
      required String owner,
      required String name,
      Value<int> rowid,
    });
typedef $CacheRepositoriesUpdateCompanionBuilder =
    CacheRepositoriesCompanion Function({
      Value<String> id,
      Value<String> owner,
      Value<String> name,
      Value<int> rowid,
    });

class $CacheRepositoriesFilterComposer
    extends Composer<_$TimelineCache, CacheRepositories> {
  $CacheRepositoriesFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get owner => $composableBuilder(
    column: $table.owner,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );
}

class $CacheRepositoriesOrderingComposer
    extends Composer<_$TimelineCache, CacheRepositories> {
  $CacheRepositoriesOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get owner => $composableBuilder(
    column: $table.owner,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );
}

class $CacheRepositoriesAnnotationComposer
    extends Composer<_$TimelineCache, CacheRepositories> {
  $CacheRepositoriesAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get owner =>
      $composableBuilder(column: $table.owner, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);
}

class $CacheRepositoriesTableManager
    extends
        RootTableManager<
          _$TimelineCache,
          CacheRepositories,
          CacheRepository,
          $CacheRepositoriesFilterComposer,
          $CacheRepositoriesOrderingComposer,
          $CacheRepositoriesAnnotationComposer,
          $CacheRepositoriesCreateCompanionBuilder,
          $CacheRepositoriesUpdateCompanionBuilder,
          (
            CacheRepository,
            BaseReferences<_$TimelineCache, CacheRepositories, CacheRepository>,
          ),
          CacheRepository,
          PrefetchHooks Function()
        > {
  $CacheRepositoriesTableManager(_$TimelineCache db, CacheRepositories table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $CacheRepositoriesFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $CacheRepositoriesOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $CacheRepositoriesAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> owner = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CacheRepositoriesCompanion(
                id: id,
                owner: owner,
                name: name,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String owner,
                required String name,
                Value<int> rowid = const Value.absent(),
              }) => CacheRepositoriesCompanion.insert(
                id: id,
                owner: owner,
                name: name,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<CacheRepositories, CacheRepository>(table),
                  BaseReferences<
                    _$TimelineCache,
                    CacheRepositories,
                    CacheRepository
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $CacheRepositoriesProcessedTableManager =
    ProcessedTableManager<
      _$TimelineCache,
      CacheRepositories,
      CacheRepository,
      $CacheRepositoriesFilterComposer,
      $CacheRepositoriesOrderingComposer,
      $CacheRepositoriesAnnotationComposer,
      $CacheRepositoriesCreateCompanionBuilder,
      $CacheRepositoriesUpdateCompanionBuilder,
      (
        CacheRepository,
        BaseReferences<_$TimelineCache, CacheRepositories, CacheRepository>,
      ),
      CacheRepository,
      PrefetchHooks Function()
    >;
typedef $CacheReleasesCreateCompanionBuilder = CacheReleasesCompanion Function({
  required String repositoryId,
  required int id,
  required int publishedAt,
  required String content,
  Value<int> rowid,
});
typedef $CacheReleasesUpdateCompanionBuilder = CacheReleasesCompanion Function({
  Value<String> repositoryId,
  Value<int> id,
  Value<int> publishedAt,
  Value<String> content,
  Value<int> rowid,
});

class $CacheReleasesFilterComposer
    extends Composer<_$TimelineCache, CacheReleases> {
  $CacheReleasesFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get publishedAt => $composableBuilder(
    column: $table.publishedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnFilters(column),
  );
}

class $CacheReleasesOrderingComposer
    extends Composer<_$TimelineCache, CacheReleases> {
  $CacheReleasesOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get publishedAt => $composableBuilder(
    column: $table.publishedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get content => $composableBuilder(
    column: $table.content,
    builder: (column) => ColumnOrderings(column),
  );
}

class $CacheReleasesAnnotationComposer
    extends Composer<_$TimelineCache, CacheReleases> {
  $CacheReleasesAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<int> get publishedAt => $composableBuilder(
    column: $table.publishedAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get content =>
      $composableBuilder(column: $table.content, builder: (column) => column);
}

class $CacheReleasesTableManager
    extends
        RootTableManager<
          _$TimelineCache,
          CacheReleases,
          CacheRelease,
          $CacheReleasesFilterComposer,
          $CacheReleasesOrderingComposer,
          $CacheReleasesAnnotationComposer,
          $CacheReleasesCreateCompanionBuilder,
          $CacheReleasesUpdateCompanionBuilder,
          (
            CacheRelease,
            BaseReferences<_$TimelineCache, CacheReleases, CacheRelease>,
          ),
          CacheRelease,
          PrefetchHooks Function()
        > {
  $CacheReleasesTableManager(_$TimelineCache db, CacheReleases table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $CacheReleasesFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $CacheReleasesOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $CacheReleasesAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> repositoryId = const Value.absent(),
                Value<int> id = const Value.absent(),
                Value<int> publishedAt = const Value.absent(),
                Value<String> content = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CacheReleasesCompanion(
                repositoryId: repositoryId,
                id: id,
                publishedAt: publishedAt,
                content: content,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String repositoryId,
                required int id,
                required int publishedAt,
                required String content,
                Value<int> rowid = const Value.absent(),
              }) => CacheReleasesCompanion.insert(
                repositoryId: repositoryId,
                id: id,
                publishedAt: publishedAt,
                content: content,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<CacheReleases, CacheRelease>(table),
                  BaseReferences<_$TimelineCache, CacheReleases, CacheRelease>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $CacheReleasesProcessedTableManager =
    ProcessedTableManager<
      _$TimelineCache,
      CacheReleases,
      CacheRelease,
      $CacheReleasesFilterComposer,
      $CacheReleasesOrderingComposer,
      $CacheReleasesAnnotationComposer,
      $CacheReleasesCreateCompanionBuilder,
      $CacheReleasesUpdateCompanionBuilder,
      (
        CacheRelease,
        BaseReferences<_$TimelineCache, CacheReleases, CacheRelease>,
      ),
      CacheRelease,
      PrefetchHooks Function()
    >;
typedef $CacheSegmentsCreateCompanionBuilder = CacheSegmentsCompanion Function({
  Value<int> id,
  required String repositoryId,
  required String cycle,
  Value<String?> requestCursor,
  Value<String?> endCursor,
  required int hasOlder,
  required int incomplete,
});
typedef $CacheSegmentsUpdateCompanionBuilder = CacheSegmentsCompanion Function({
  Value<int> id,
  Value<String> repositoryId,
  Value<String> cycle,
  Value<String?> requestCursor,
  Value<String?> endCursor,
  Value<int> hasOlder,
  Value<int> incomplete,
});

class $CacheSegmentsFilterComposer
    extends Composer<_$TimelineCache, CacheSegments> {
  $CacheSegmentsFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cycle => $composableBuilder(
    column: $table.cycle,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get requestCursor => $composableBuilder(
    column: $table.requestCursor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get endCursor => $composableBuilder(
    column: $table.endCursor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get hasOlder => $composableBuilder(
    column: $table.hasOlder,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get incomplete => $composableBuilder(
    column: $table.incomplete,
    builder: (column) => ColumnFilters(column),
  );
}

class $CacheSegmentsOrderingComposer
    extends Composer<_$TimelineCache, CacheSegments> {
  $CacheSegmentsOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cycle => $composableBuilder(
    column: $table.cycle,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get requestCursor => $composableBuilder(
    column: $table.requestCursor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get endCursor => $composableBuilder(
    column: $table.endCursor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get hasOlder => $composableBuilder(
    column: $table.hasOlder,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get incomplete => $composableBuilder(
    column: $table.incomplete,
    builder: (column) => ColumnOrderings(column),
  );
}

class $CacheSegmentsAnnotationComposer
    extends Composer<_$TimelineCache, CacheSegments> {
  $CacheSegmentsAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get cycle =>
      $composableBuilder(column: $table.cycle, builder: (column) => column);

  GeneratedColumn<String> get requestCursor => $composableBuilder(
    column: $table.requestCursor,
    builder: (column) => column,
  );

  GeneratedColumn<String> get endCursor =>
      $composableBuilder(column: $table.endCursor, builder: (column) => column);

  GeneratedColumn<int> get hasOlder =>
      $composableBuilder(column: $table.hasOlder, builder: (column) => column);

  GeneratedColumn<int> get incomplete => $composableBuilder(
    column: $table.incomplete,
    builder: (column) => column,
  );
}

class $CacheSegmentsTableManager
    extends
        RootTableManager<
          _$TimelineCache,
          CacheSegments,
          CacheSegment,
          $CacheSegmentsFilterComposer,
          $CacheSegmentsOrderingComposer,
          $CacheSegmentsAnnotationComposer,
          $CacheSegmentsCreateCompanionBuilder,
          $CacheSegmentsUpdateCompanionBuilder,
          (
            CacheSegment,
            BaseReferences<_$TimelineCache, CacheSegments, CacheSegment>,
          ),
          CacheSegment,
          PrefetchHooks Function()
        > {
  $CacheSegmentsTableManager(_$TimelineCache db, CacheSegments table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $CacheSegmentsFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $CacheSegmentsOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $CacheSegmentsAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> repositoryId = const Value.absent(),
                Value<String> cycle = const Value.absent(),
                Value<String?> requestCursor = const Value.absent(),
                Value<String?> endCursor = const Value.absent(),
                Value<int> hasOlder = const Value.absent(),
                Value<int> incomplete = const Value.absent(),
              }) => CacheSegmentsCompanion(
                id: id,
                repositoryId: repositoryId,
                cycle: cycle,
                requestCursor: requestCursor,
                endCursor: endCursor,
                hasOlder: hasOlder,
                incomplete: incomplete,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String repositoryId,
                required String cycle,
                Value<String?> requestCursor = const Value.absent(),
                Value<String?> endCursor = const Value.absent(),
                required int hasOlder,
                required int incomplete,
              }) => CacheSegmentsCompanion.insert(
                id: id,
                repositoryId: repositoryId,
                cycle: cycle,
                requestCursor: requestCursor,
                endCursor: endCursor,
                hasOlder: hasOlder,
                incomplete: incomplete,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<CacheSegments, CacheSegment>(table),
                  BaseReferences<_$TimelineCache, CacheSegments, CacheSegment>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $CacheSegmentsProcessedTableManager =
    ProcessedTableManager<
      _$TimelineCache,
      CacheSegments,
      CacheSegment,
      $CacheSegmentsFilterComposer,
      $CacheSegmentsOrderingComposer,
      $CacheSegmentsAnnotationComposer,
      $CacheSegmentsCreateCompanionBuilder,
      $CacheSegmentsUpdateCompanionBuilder,
      (
        CacheSegment,
        BaseReferences<_$TimelineCache, CacheSegments, CacheSegment>,
      ),
      CacheSegment,
      PrefetchHooks Function()
    >;
typedef $CachePageMembersCreateCompanionBuilder =
    CachePageMembersCompanion Function({
      required int segmentId,
      required String repositoryId,
      required int releaseId,
      Value<int> rowid,
    });
typedef $CachePageMembersUpdateCompanionBuilder =
    CachePageMembersCompanion Function({
      Value<int> segmentId,
      Value<String> repositoryId,
      Value<int> releaseId,
      Value<int> rowid,
    });

class $CachePageMembersFilterComposer
    extends Composer<_$TimelineCache, CachePageMembers> {
  $CachePageMembersFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get segmentId => $composableBuilder(
    column: $table.segmentId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get releaseId => $composableBuilder(
    column: $table.releaseId,
    builder: (column) => ColumnFilters(column),
  );
}

class $CachePageMembersOrderingComposer
    extends Composer<_$TimelineCache, CachePageMembers> {
  $CachePageMembersOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get segmentId => $composableBuilder(
    column: $table.segmentId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get releaseId => $composableBuilder(
    column: $table.releaseId,
    builder: (column) => ColumnOrderings(column),
  );
}

class $CachePageMembersAnnotationComposer
    extends Composer<_$TimelineCache, CachePageMembers> {
  $CachePageMembersAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get segmentId =>
      $composableBuilder(column: $table.segmentId, builder: (column) => column);

  GeneratedColumn<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get releaseId =>
      $composableBuilder(column: $table.releaseId, builder: (column) => column);
}

class $CachePageMembersTableManager
    extends
        RootTableManager<
          _$TimelineCache,
          CachePageMembers,
          CachePageMember,
          $CachePageMembersFilterComposer,
          $CachePageMembersOrderingComposer,
          $CachePageMembersAnnotationComposer,
          $CachePageMembersCreateCompanionBuilder,
          $CachePageMembersUpdateCompanionBuilder,
          (
            CachePageMember,
            BaseReferences<_$TimelineCache, CachePageMembers, CachePageMember>,
          ),
          CachePageMember,
          PrefetchHooks Function()
        > {
  $CachePageMembersTableManager(_$TimelineCache db, CachePageMembers table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $CachePageMembersFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $CachePageMembersOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $CachePageMembersAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> segmentId = const Value.absent(),
                Value<String> repositoryId = const Value.absent(),
                Value<int> releaseId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachePageMembersCompanion(
                segmentId: segmentId,
                repositoryId: repositoryId,
                releaseId: releaseId,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required int segmentId,
                required String repositoryId,
                required int releaseId,
                Value<int> rowid = const Value.absent(),
              }) => CachePageMembersCompanion.insert(
                segmentId: segmentId,
                repositoryId: repositoryId,
                releaseId: releaseId,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<CachePageMembers, CachePageMember>(table),
                  BaseReferences<
                    _$TimelineCache,
                    CachePageMembers,
                    CachePageMember
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $CachePageMembersProcessedTableManager =
    ProcessedTableManager<
      _$TimelineCache,
      CachePageMembers,
      CachePageMember,
      $CachePageMembersFilterComposer,
      $CachePageMembersOrderingComposer,
      $CachePageMembersAnnotationComposer,
      $CachePageMembersCreateCompanionBuilder,
      $CachePageMembersUpdateCompanionBuilder,
      (
        CachePageMember,
        BaseReferences<_$TimelineCache, CachePageMembers, CachePageMember>,
      ),
      CachePageMember,
      PrefetchHooks Function()
    >;
typedef $CacheVisibleCreateCompanionBuilder = CacheVisibleCompanion Function({
  required String repositoryId,
  required int releaseId,
  required int oldestShown,
  Value<int> rowid,
});
typedef $CacheVisibleUpdateCompanionBuilder = CacheVisibleCompanion Function({
  Value<String> repositoryId,
  Value<int> releaseId,
  Value<int> oldestShown,
  Value<int> rowid,
});

class $CacheVisibleFilterComposer
    extends Composer<_$TimelineCache, CacheVisible> {
  $CacheVisibleFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get releaseId => $composableBuilder(
    column: $table.releaseId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get oldestShown => $composableBuilder(
    column: $table.oldestShown,
    builder: (column) => ColumnFilters(column),
  );
}

class $CacheVisibleOrderingComposer
    extends Composer<_$TimelineCache, CacheVisible> {
  $CacheVisibleOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get releaseId => $composableBuilder(
    column: $table.releaseId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get oldestShown => $composableBuilder(
    column: $table.oldestShown,
    builder: (column) => ColumnOrderings(column),
  );
}

class $CacheVisibleAnnotationComposer
    extends Composer<_$TimelineCache, CacheVisible> {
  $CacheVisibleAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get repositoryId => $composableBuilder(
    column: $table.repositoryId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get releaseId =>
      $composableBuilder(column: $table.releaseId, builder: (column) => column);

  GeneratedColumn<int> get oldestShown => $composableBuilder(
    column: $table.oldestShown,
    builder: (column) => column,
  );
}

class $CacheVisibleTableManager
    extends
        RootTableManager<
          _$TimelineCache,
          CacheVisible,
          CacheVisibleData,
          $CacheVisibleFilterComposer,
          $CacheVisibleOrderingComposer,
          $CacheVisibleAnnotationComposer,
          $CacheVisibleCreateCompanionBuilder,
          $CacheVisibleUpdateCompanionBuilder,
          (
            CacheVisibleData,
            BaseReferences<_$TimelineCache, CacheVisible, CacheVisibleData>,
          ),
          CacheVisibleData,
          PrefetchHooks Function()
        > {
  $CacheVisibleTableManager(_$TimelineCache db, CacheVisible table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $CacheVisibleFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $CacheVisibleOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $CacheVisibleAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> repositoryId = const Value.absent(),
                Value<int> releaseId = const Value.absent(),
                Value<int> oldestShown = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CacheVisibleCompanion(
                repositoryId: repositoryId,
                releaseId: releaseId,
                oldestShown: oldestShown,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String repositoryId,
                required int releaseId,
                required int oldestShown,
                Value<int> rowid = const Value.absent(),
              }) => CacheVisibleCompanion.insert(
                repositoryId: repositoryId,
                releaseId: releaseId,
                oldestShown: oldestShown,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<CacheVisible, CacheVisibleData>(table),
                  BaseReferences<
                    _$TimelineCache,
                    CacheVisible,
                    CacheVisibleData
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $CacheVisibleProcessedTableManager =
    ProcessedTableManager<
      _$TimelineCache,
      CacheVisible,
      CacheVisibleData,
      $CacheVisibleFilterComposer,
      $CacheVisibleOrderingComposer,
      $CacheVisibleAnnotationComposer,
      $CacheVisibleCreateCompanionBuilder,
      $CacheVisibleUpdateCompanionBuilder,
      (
        CacheVisibleData,
        BaseReferences<_$TimelineCache, CacheVisible, CacheVisibleData>,
      ),
      CacheVisibleData,
      PrefetchHooks Function()
    >;

class $TimelineCacheManager {
  final _$TimelineCache _db;
  $TimelineCacheManager(this._db);
  $CacheAccountTableManager get cacheAccount =>
      $CacheAccountTableManager(_db, _db.cacheAccount);
  $CacheRepositoriesTableManager get cacheRepositories =>
      $CacheRepositoriesTableManager(_db, _db.cacheRepositories);
  $CacheReleasesTableManager get cacheReleases =>
      $CacheReleasesTableManager(_db, _db.cacheReleases);
  $CacheSegmentsTableManager get cacheSegments =>
      $CacheSegmentsTableManager(_db, _db.cacheSegments);
  $CachePageMembersTableManager get cachePageMembers =>
      $CachePageMembersTableManager(_db, _db.cachePageMembers);
  $CacheVisibleTableManager get cacheVisible =>
      $CacheVisibleTableManager(_db, _db.cacheVisible);
}
