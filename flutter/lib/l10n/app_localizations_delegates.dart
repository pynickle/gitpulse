import 'package:material_ui/material_ui.dart';

import 'generated/app_localizations.dart';

/// The app's localizations delegates: its own strings plus the Material, Cupertino and Widgets ones.
///
/// The generated `AppLocalizations.localizationsDelegates` cannot be used since Flutter 3.50: it
/// still lists the delegates from `package:flutter_localizations`, which the framework deprecated in
/// favour of the copies in `package:material_ui`, and a delegate from the wrong library provides no
/// `MaterialLocalizations` for `MaterialApp` at all. Issue flutter/flutter#194500 tracks making
/// gen-l10n emit the migrated list; until then this list is the app's.
const List<LocalizationsDelegate<dynamic>> appLocalizationsDelegates =
    <LocalizationsDelegate<dynamic>>[
      AppLocalizations.delegate,
      ...GlobalMaterialLocalizations.delegates,
    ];
