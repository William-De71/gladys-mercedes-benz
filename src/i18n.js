// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback), the four languages of the Gladys interface.
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, text states, widget contents, scene
// summaries, messages of the Configuration screen.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: {
    en: 'Mercedes-Benz {model}',
    fr: 'Mercedes-Benz {model}',
    de: 'Mercedes-Benz {model}',
    es: 'Mercedes-Benz {model}',
  },
  defaultModel: { en: 'car', fr: 'voiture', de: 'Fahrzeug', es: 'coche' },
  featureBatteryLevel: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  featureBatteryRange: {
    en: 'Electric range',
    fr: 'Autonomie électrique',
    de: 'Elektrische Reichweite',
    es: 'Autonomía eléctrica',
  },
  featureFuelLevel: {
    en: 'Fuel level',
    fr: 'Niveau de carburant',
    de: 'Tankfüllstand',
    es: 'Nivel de combustible',
  },
  featureFuelRange: {
    en: 'Fuel range',
    fr: 'Autonomie carburant',
    de: 'Kraftstoffreichweite',
    es: 'Autonomía de combustible',
  },
  featureOdometer: {
    en: 'Odometer',
    fr: 'Kilométrage',
    de: 'Kilometerstand',
    es: 'Cuentakilómetros',
  },
  featureLock: { en: 'Lock', fr: 'Verrouillage', de: 'Verriegelung', es: 'Cierre' },
  featureAlarm: {
    en: 'Anti-theft alarm armed',
    fr: 'Alarme antivol armée',
    de: 'Diebstahlwarnanlage scharf',
    es: 'Alarma antirrobo activada',
  },
  featureDoors: { en: 'Doors', fr: 'Portes', de: 'Türen', es: 'Puertas' },
  featureTrunk: { en: 'Trunk', fr: 'Coffre', de: 'Kofferraum', es: 'Maletero' },
  featureHood: { en: 'Hood', fr: 'Capot', de: 'Motorhaube', es: 'Capó' },
  featureWindows: { en: 'Windows', fr: 'Fenêtres', de: 'Fenster', es: 'Ventanillas' },
  featureSunroof: { en: 'Sunroof', fr: 'Toit ouvrant', de: 'Schiebedach', es: 'Techo solar' },
  featurePlugged: {
    en: 'Charging cable plugged in',
    fr: 'Câble de charge branché',
    de: 'Ladekabel angeschlossen',
    es: 'Cable de carga enchufado',
  },
  featureCharging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  featureChargingStatus: {
    en: 'Charging status',
    fr: 'État de la charge',
    de: 'Ladestatus',
    es: 'Estado de la carga',
  },
  featureChargePower: {
    en: 'Charging power',
    fr: 'Puissance de charge',
    de: 'Ladeleistung',
    es: 'Potencia de carga',
  },
  featureChargeTarget: {
    en: 'Charge limit',
    fr: 'Limite de charge',
    de: 'Ladelimit',
    es: 'Límite de carga',
  },
  featureClimate: {
    en: 'Pre-climatisation',
    fr: 'Préclimatisation',
    de: 'Vorklimatisierung',
    es: 'Preclimatización',
  },
  featureTireFrontLeft: {
    en: 'Tire front left',
    fr: 'Pneu avant gauche',
    de: 'Reifen vorne links',
    es: 'Neumático delantero izquierdo',
  },
  featureTireFrontRight: {
    en: 'Tire front right',
    fr: 'Pneu avant droit',
    de: 'Reifen vorne rechts',
    es: 'Neumático delantero derecho',
  },
  featureTireRearLeft: {
    en: 'Tire rear left',
    fr: 'Pneu arrière gauche',
    de: 'Reifen hinten links',
    es: 'Neumático trasero izquierdo',
  },
  featureTireRearRight: {
    en: 'Tire rear right',
    fr: 'Pneu arrière droit',
    de: 'Reifen hinten rechts',
    es: 'Neumático trasero derecho',
  },
  featureServiceDays: {
    en: 'Days to service',
    fr: 'Jours avant l’entretien',
    de: 'Tage bis zur Wartung',
    es: 'Días hasta el mantenimiento',
  },
  featureServiceDistance: {
    en: 'Distance to service',
    fr: 'Distance avant l’entretien',
    de: 'Strecke bis zur Wartung',
    es: 'Distancia hasta el mantenimiento',
  },
  featureWarnings: { en: 'Warnings', fr: 'Alertes', de: 'Warnungen', es: 'Alertas' },
  featureDistanceHome: {
    en: 'Distance from home',
    fr: 'Distance du domicile',
    de: 'Entfernung von zu Hause',
    es: 'Distancia de casa',
  },

  // charge status
  charge_charging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  charge_complete: { en: 'Charged', fr: 'Chargée', de: 'Geladen', es: 'Cargado' },
  charge_paused: { en: 'Paused', fr: 'En pause', de: 'Pausiert', es: 'En pausa' },
  charge_unplugged: {
    en: 'Unplugged',
    fr: 'Débranchée',
    de: 'Nicht angeschlossen',
    es: 'Desenchufado',
  },
  charge_error: {
    en: 'Charging error',
    fr: 'Erreur de charge',
    de: 'Ladefehler',
    es: 'Error de carga',
  },
  charge_discharging: { en: 'Discharging', fr: 'En décharge', de: 'Entlädt', es: 'Descargando' },
  charge_idle: { en: 'Not charging', fr: 'Pas en charge', de: 'Lädt nicht', es: 'Sin cargar' },
  charge_waiting: {
    en: 'Waiting for energy',
    fr: 'En attente d’énergie',
    de: 'Wartet auf Energie',
    es: 'Esperando energía',
  },
  charge_calibrating: {
    en: 'Battery calibration',
    fr: 'Calibrage de la batterie',
    de: 'Batteriekalibrierung',
    es: 'Calibración de la batería',
  },

  // warnings and openings
  noWarning: { en: 'None', fr: 'Aucune', de: 'Keine', es: 'Ninguna' },
  warning_low_battery: {
    en: '12 V battery low',
    fr: 'Batterie 12 V faible',
    de: '12-V-Batterie schwach',
    es: 'Batería de 12 V baja',
  },
  warning_tire_pressure: {
    en: 'Tire pressure',
    fr: 'Pression des pneus',
    de: 'Reifendruck',
    es: 'Presión de los neumáticos',
  },
  warning_brake_fluid: {
    en: 'Brake fluid',
    fr: 'Liquide de frein',
    de: 'Bremsflüssigkeit',
    es: 'Líquido de frenos',
  },
  warning_brake_lining: {
    en: 'Brake pads worn',
    fr: 'Plaquettes de frein usées',
    de: 'Bremsbeläge verschlissen',
    es: 'Pastillas de freno desgastadas',
  },
  warning_coolant: {
    en: 'Coolant low',
    fr: 'Liquide de refroidissement bas',
    de: 'Kühlmittel niedrig',
    es: 'Refrigerante bajo',
  },
  warning_engine_light: {
    en: 'Engine warning light',
    fr: 'Voyant moteur',
    de: 'Motorkontrollleuchte',
    es: 'Testigo del motor',
  },
  warning_washer_fluid: {
    en: 'Washer fluid low',
    fr: 'Lave-glace bas',
    de: 'Waschwasser niedrig',
    es: 'Líquido limpiaparabrisas bajo',
  },
  warning_other: { en: 'Warning', fr: 'Alerte', de: 'Warnung', es: 'Alerta' },
  opening_doors: { en: 'doors', fr: 'portes', de: 'Türen', es: 'puertas' },
  opening_trunk: { en: 'trunk', fr: 'coffre', de: 'Kofferraum', es: 'maletero' },
  opening_hood: { en: 'hood', fr: 'capot', de: 'Motorhaube', es: 'capó' },
  opening_windows: { en: 'windows', fr: 'fenêtres', de: 'Fenster', es: 'ventanillas' },
  opening_sunroof: { en: 'sunroof', fr: 'toit ouvrant', de: 'Schiebedach', es: 'techo solar' },
  locked: { en: 'Locked', fr: 'Verrouillée', de: 'Verriegelt', es: 'Cerrado' },
  unlocked: { en: 'Unlocked', fr: 'Déverrouillée', de: 'Entriegelt', es: 'Abierto' },
  allClosed: {
    en: 'All closed',
    fr: 'Tout est fermé',
    de: 'Alles geschlossen',
    es: 'Todo cerrado',
  },
  open: { en: 'Open: {list}', fr: 'Ouvert : {list}', de: 'Offen: {list}', es: 'Abierto: {list}' },

  // scene summaries
  summaryLocked: {
    en: '{car} is locked.',
    fr: '{car} est verrouillée.',
    de: '{car} ist verriegelt.',
    es: '{car} está cerrado.',
  },
  summaryUnlocked: {
    en: '{car} is unlocked.',
    fr: '{car} est déverrouillée.',
    de: '{car} ist entriegelt.',
    es: '{car} está abierto.',
  },
  summaryLeftOpen: {
    en: '{car} is locked but still open: {list}.',
    fr: '{car} est verrouillée mais encore ouverte : {list}.',
    de: '{car} ist verriegelt, aber noch offen: {list}.',
    es: '{car} está cerrado pero sigue abierto: {list}.',
  },
  summaryAlarm: {
    en: 'The anti-theft alarm of {car} went off.',
    fr: 'L’alarme antivol de {car} s’est déclenchée.',
    de: 'Die Diebstahlwarnanlage von {car} wurde ausgelöst.',
    es: 'La alarma antirrobo de {car} se ha disparado.',
  },
  summaryEngineStarted: {
    en: '{car}: engine started.',
    fr: '{car} : moteur démarré.',
    de: '{car}: Motor gestartet.',
    es: '{car}: motor arrancado.',
  },
  summaryEngineStopped: {
    en: '{car}: engine stopped.',
    fr: '{car} : moteur arrêté.',
    de: '{car}: Motor abgestellt.',
    es: '{car}: motor apagado.',
  },
  summaryCharging: {
    en: '{car}: {status} ({level} %).',
    fr: '{car} : {status} ({level} %).',
    de: '{car}: {status} ({level} %).',
    es: '{car}: {status} ({level} %).',
  },
  summaryPlugged: {
    en: '{car}: charging cable plugged in.',
    fr: '{car} : câble de charge branché.',
    de: '{car}: Ladekabel angeschlossen.',
    es: '{car}: cable de carga enchufado.',
  },
  summaryUnplugged: {
    en: '{car}: charging cable unplugged.',
    fr: '{car} : câble de charge débranché.',
    de: '{car}: Ladekabel abgezogen.',
    es: '{car}: cable de carga desenchufado.',
  },
  summaryArrived: {
    en: '{car} has arrived home.',
    fr: '{car} est arrivée à la maison.',
    de: '{car} ist zu Hause angekommen.',
    es: '{car} ha llegado a casa.',
  },
  summaryLeft: {
    en: '{car} has left home.',
    fr: '{car} a quitté la maison.',
    de: '{car} hat das Zuhause verlassen.',
    es: '{car} ha salido de casa.',
  },
  summaryWarning: {
    en: '{car}: {warning}.',
    fr: '{car} : {warning}.',
    de: '{car}: {warning}.',
    es: '{car}: {warning}.',
  },
  summaryBattery: {
    en: 'Battery {level} %, {range} km.',
    fr: 'Batterie {level} %, {range} km.',
    de: 'Batterie {level} %, {range} km.',
    es: 'Batería {level} %, {range} km.',
  },
  summaryFuel: {
    en: 'Fuel {level} %, {range} km.',
    fr: 'Carburant {level} %, {range} km.',
    de: 'Tank {level} %, {range} km.',
    es: 'Combustible {level} %, {range} km.',
  },
  summaryStatus: {
    en: '{car}: {lock}, {openings}. {energy}',
    fr: '{car} : {lock}, {openings}. {energy}',
    de: '{car}: {lock}, {openings}. {energy}',
    es: '{car}: {lock}, {openings}. {energy}',
  },
  problem_auth: {
    en: 'Mercedes me refused the e-mail or the password: check them in the integration settings.',
    fr: 'Mercedes me a refusé l’e-mail ou le mot de passe : vérifiez-les dans les réglages de l’intégration.',
    de: 'Mercedes me hat E-Mail oder Passwort abgelehnt: Prüfen Sie sie in den Einstellungen der Integration.',
    es: 'Mercedes me ha rechazado el correo o la contraseña: compruébelos en los ajustes de la integración.',
  },
  problem_two_factor: {
    en: 'The Mercedes me account asks for a code (two-factor authentication): turn it off or use another account.',
    fr: 'Le compte Mercedes me demande un code (double authentification) : désactivez-la ou utilisez un autre compte.',
    de: 'Das Mercedes-me-Konto verlangt einen Code (Zwei-Faktor-Authentifizierung): Deaktivieren oder anderes Konto nutzen.',
    es: 'La cuenta Mercedes me pide un código (doble autenticación): desactívela o use otra cuenta.',
  },
  problem_blocked: {
    en: 'Mercedes blocks the account for too many requests, often until midnight GMT. Values come slower meanwhile.',
    fr: 'Mercedes bloque le compte pour trop de requêtes, souvent jusqu’à minuit GMT. Valeurs plus lentes en attendant.',
    de: 'Mercedes sperrt das Konto wegen zu vieler Anfragen, oft bis Mitternacht GMT. Werte kommen derweil langsamer.',
    es: 'Mercedes bloquea la cuenta por demasiadas solicitudes, a menudo hasta medianoche GMT. Valores más lentos.',
  },
  problem_outdated: {
    en: 'Mercedes refuses this app version (418): update the integration, or set the app version in Advanced.',
    fr: 'Mercedes refuse cette version d’application (418) : mettez à jour l’intégration ou réglez la version (Avancé).',
    de: 'Mercedes lehnt diese App-Version ab (418): Integration aktualisieren oder App-Version unter Erweitert setzen.',
    es: 'Mercedes rechaza esta versión de la app (418): actualice la integración o indique la versión en Avanzado.',
  },

  // widget
  battery: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  fuel: { en: 'Fuel', fr: 'Carburant', de: 'Tank', es: 'Combustible' },
  range: { en: 'Range', fr: 'Autonomie', de: 'Reichweite', es: 'Autonomía' },
  odometer: { en: 'Odometer', fr: 'Compteur', de: 'Kilometer', es: 'Kilometraje' },
  lockState: { en: 'Lock', fr: 'Verrouillage', de: 'Verriegelung', es: 'Cierre' },
  openings: { en: 'Openings', fr: 'Ouvrants', de: 'Öffnungen', es: 'Aperturas' },
  charging: { en: 'Charge', fr: 'Charge', de: 'Laden', es: 'Carga' },
  chargeUntil: {
    en: '{status} until {time}',
    fr: '{status} jusqu’à {time}',
    de: '{status} bis {time}',
    es: '{status} hasta las {time}',
  },
  climate: { en: 'Climate', fr: 'Climatisation', de: 'Klima', es: 'Climatización' },
  on: { en: 'On', fr: 'En marche', de: 'An', es: 'Encendida' },
  off: { en: 'Off', fr: 'Arrêtée', de: 'Aus', es: 'Apagada' },
  engine: { en: 'Engine', fr: 'Moteur', de: 'Motor', es: 'Motor' },
  running: { en: 'Running', fr: 'En marche', de: 'Läuft', es: 'En marcha' },
  stopped: { en: 'Stopped', fr: 'Arrêté', de: 'Aus', es: 'Apagado' },
  position: { en: 'Position', fr: 'Position', de: 'Position', es: 'Posición' },
  atHome: { en: 'At home', fr: 'À la maison', de: 'Zu Hause', es: 'En casa' },
  awayFrom: {
    en: '{km} km from home',
    fr: 'À {km} km de la maison',
    de: '{km} km von zu Hause',
    es: 'A {km} km de casa',
  },
  alarm: { en: 'Alarm', fr: 'Alarme', de: 'Alarmanlage', es: 'Alarma' },
  alarmTriggered: { en: 'Triggered!', fr: 'Déclenchée !', de: 'Ausgelöst!', es: '¡Disparada!' },
  armed: { en: 'Armed', fr: 'Armée', de: 'Scharf', es: 'Activada' },
  disarmed: { en: 'Disarmed', fr: 'Désarmée', de: 'Unscharf', es: 'Desactivada' },
  warnings: { en: 'Warnings', fr: 'Alertes', de: 'Warnungen', es: 'Alertas' },
  updated: { en: 'Updated', fr: 'Mis à jour', de: 'Aktualisiert', es: 'Actualizado' },
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },
  buttonUnlock: { en: 'Unlock', fr: 'Déverrouiller', de: 'Entriegeln', es: 'Abrir' },
  buttonLock: { en: 'Lock', fr: 'Verrouiller', de: 'Verriegeln', es: 'Cerrar' },
  buttonClimateStart: {
    en: 'Pre-climatise',
    fr: 'Préclimatiser',
    de: 'Vorklimatisieren',
    es: 'Preclimatizar',
  },
  buttonClimateStop: {
    en: 'Stop climate',
    fr: 'Arrêter la clim',
    de: 'Klima stoppen',
    es: 'Parar climatización',
  },
  buttonFlash: {
    en: 'Flash lights',
    fr: 'Faire clignoter',
    de: 'Lichthupe',
    es: 'Destellar luces',
  },
  buttonMap: { en: 'Map', fr: 'Carte', de: 'Karte', es: 'Mapa' },
  loading: {
    en: 'Waiting for the first data from Mercedes…',
    fr: 'En attente des premières données de Mercedes…',
    de: 'Warten auf die ersten Daten von Mercedes…',
    es: 'Esperando los primeros datos de Mercedes…',
  },
  notReady: {
    en: 'Enter your Mercedes me account in the integration settings.',
    fr: 'Renseignez votre compte Mercedes me dans les réglages de l’intégration.',
    de: 'Geben Sie Ihr Mercedes-me-Konto in den Einstellungen der Integration ein.',
    es: 'Indique su cuenta Mercedes me en los ajustes de la integración.',
  },
  noVehicle: {
    en: 'No car in this Mercedes me account.',
    fr: 'Aucune voiture dans ce compte Mercedes me.',
    de: 'Kein Fahrzeug in diesem Mercedes-me-Konto.',
    es: 'Ningún coche en esta cuenta Mercedes me.',
  },
  transportBlocked: {
    en: 'Mercedes blocks the live connection for now: values are read more slowly.',
    fr: 'Mercedes bloque la connexion en direct pour l’instant : les valeurs arrivent plus lentement.',
    de: 'Mercedes sperrt die Live-Verbindung vorerst: Werte werden langsamer gelesen.',
    es: 'Mercedes bloquea la conexión en directo por ahora: los valores llegan más despacio.',
  },

  // connection status
  statusNoAccount: {
    en: 'Enter the e-mail and the password of your Mercedes me account.',
    fr: 'Renseignez l’e-mail et le mot de passe de votre compte Mercedes me.',
    de: 'Geben Sie E-Mail und Passwort Ihres Mercedes-me-Kontos ein.',
    es: 'Indique el correo y la contraseña de su cuenta Mercedes me.',
  },
  statusConnected: {
    en: 'Connected to Mercedes me: {count} car(s).',
    fr: 'Connecté à Mercedes me : {count} voiture(s).',
    de: 'Mit Mercedes me verbunden: {count} Fahrzeug(e).',
    es: 'Conectado a Mercedes me: {count} coche(s).',
  },
  statusUnreachable: {
    en: 'The Mercedes servers cannot be reached: retrying.',
    fr: 'Les serveurs Mercedes sont injoignables : nouvel essai en cours.',
    de: 'Die Mercedes-Server sind nicht erreichbar: neuer Versuch läuft.',
    es: 'No se puede acceder a los servidores de Mercedes: reintentando.',
  },

  // commands
  command_lock: { en: 'lock', fr: 'verrouillage', de: 'Verriegeln', es: 'cierre' },
  command_unlock: { en: 'unlock', fr: 'déverrouillage', de: 'Entriegeln', es: 'apertura' },
  command_climate_start: {
    en: 'pre-climatisation',
    fr: 'préclimatisation',
    de: 'Vorklimatisierung',
    es: 'preclimatización',
  },
  command_climate_stop: {
    en: 'climate stop',
    fr: 'arrêt de la climatisation',
    de: 'Klima-Stopp',
    es: 'parada de la climatización',
  },
  command_flash: {
    en: 'flash lights',
    fr: 'clignotement',
    de: 'Lichthupe',
    es: 'destello de luces',
  },
  command_horn: { en: 'horn', fr: 'klaxon', de: 'Hupe', es: 'claxon' },
  command_windows_close: {
    en: 'close windows',
    fr: 'fermeture des fenêtres',
    de: 'Fenster schließen',
    es: 'cierre de ventanillas',
  },
  command_charge_limit: {
    en: 'charge limit',
    fr: 'limite de charge',
    de: 'Ladelimit',
    es: 'límite de carga',
  },
  commandSent: {
    en: 'Sent to the car: {command}.',
    fr: 'Envoyé à la voiture : {command}.',
    de: 'An das Fahrzeug gesendet: {command}.',
    es: 'Enviado al coche: {command}.',
  },
  commandDone: {
    en: 'Done: {command}.',
    fr: 'Effectué : {command}.',
    de: 'Erledigt: {command}.',
    es: 'Hecho: {command}.',
  },
  commandFailed: {
    en: 'Not carried out: {command} ({status}).',
    fr: 'Non exécuté : {command} ({status}).',
    de: 'Nicht ausgeführt: {command} ({status}).',
    es: 'No ejecutado: {command} ({status}).',
  },
  commandUnsupported: {
    en: 'This car does not accept the command: {command}.',
    fr: 'Cette voiture n’accepte pas la commande : {command}.',
    de: 'Dieses Fahrzeug akzeptiert den Befehl nicht: {command}.',
    es: 'Este coche no acepta la orden: {command}.',
  },
  commandPinRequired: {
    en: 'Unlocking needs the security PIN of the Mercedes me app (integration settings).',
    fr: 'Le déverrouillage demande le code PIN de sécurité de l’app Mercedes me (réglages de l’intégration).',
    de: 'Zum Entriegeln ist die Sicherheits-PIN der Mercedes-me-App nötig (Einstellungen der Integration).',
    es: 'Para abrir hace falta el PIN de seguridad de la app Mercedes me (ajustes de la integración).',
  },

  // configuration actions
  testConnected: {
    en: 'Signed in. Cars: {list}',
    fr: 'Connexion réussie. Voitures : {list}',
    de: 'Angemeldet. Fahrzeuge: {list}',
    es: 'Sesión iniciada. Coches: {list}',
  },
  commandCount: {
    en: '{count} commands',
    fr: '{count} commandes',
    de: '{count} Befehle',
    es: '{count} órdenes',
  },
  diagnosticDone: {
    en: 'Diagnostic of {count} car(s) written to the Logs tab, without VIN, plate nor position.',
    fr: 'Diagnostic de {count} voiture(s) écrit dans l’onglet Journaux, sans VIN, plaque ni position.',
    de: 'Diagnose von {count} Fahrzeug(en) im Tab Protokolle, ohne FIN, Kennzeichen und Position.',
    es: 'Diagnóstico de {count} coche(s) escrito en la pestaña Registros, sin VIN, matrícula ni posición.',
  },
  signedOut: {
    en: 'Session forgotten: the integration signs in again at the next session.',
    fr: 'Session oubliée : l’intégration se reconnecte à la prochaine session.',
    de: 'Sitzung verworfen: Die Integration meldet sich bei der nächsten Sitzung neu an.',
    es: 'Sesión olvidada: la integración inicia sesión de nuevo en la próxima sesión.',
  },
};

/**
 * @description Pick a text in a language (English fallback), with `{name}`
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('summaryArrived', 'fr', { car: 'Mercedes-Benz EQA 250' });
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description A multi-language message built language by language.
 * @param {Function} build - `(language) => string`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function each(build) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
}

/**
 * @description The text in every language.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return each((language) => t(key, language, values));
}

/**
 * @description The label of a warning key.
 * @param {string} warning - The key.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
function warningLabel(warning, language) {
  const key = `warning_${warning}`;
  return TEXTS[key] ? t(key, language) : t('warning_other', language);
}

/**
 * @description A list of openings, "doors, trunk".
 * @param {string[]} openings - The opening names.
 * @param {string} language - The language.
 * @returns {string} The list.
 */
function openingsLabel(openings, language) {
  return openings.map((name) => t(`opening_${name}`, language)).join(', ');
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, t, all, each, warningLabel, openingsLabel, ago };
