# Mercedes-Benz

## Présentation

Cette intégration amène dans Gladys les voitures Mercedes-Benz de votre compte **Mercedes me**, via les serveurs de l’application Mercedes me, comme l’intégration Home Assistant mbapi2020 :

- un appareil par voiture : batterie ou carburant, autonomie, kilométrage, verrouillage, alarme antivol, portes, coffre, fenêtres, toit ouvrant, charge, préclimatisation, pression des pneus, entretien, alertes et distance du domicile ;
- des commandes quand la voiture les accepte : verrouiller, déverrouiller, préclimatisation, limite de charge, faire clignoter les feux, klaxon, fermer les fenêtres ;
- des déclencheurs et actions de scène, et un widget de tableau de bord par voiture.

Mercedes pousse chaque changement de la voiture : les valeurs suivent en une à deux minutes. Tout passe par le cloud Mercedes (transport cloud) : la voiture n’est jamais jointe sur votre réseau. Il s’agit d’une intégration communautaire, non affiliée à Mercedes-Benz ; les serveurs Mercedes me n’ont pas de documentation publique et peuvent changer.

## Prérequis

- Gladys Assistant 5.1.0 ou plus récent.
- Une voiture connectée à Mercedes me (Mercedes me connect en Amérique du Nord), et l’e-mail et le mot de passe du compte, connecté une fois dans l’application officielle.
- **Pas de double authentification** sur ce compte : Gladys doit se reconnecter seule environ toutes les 18 heures. Le mieux : créer un second compte Mercedes me, le faire inviter sur la voiture par l’utilisateur principal (jusqu’à six utilisateurs par voiture), puis ne l’utiliser que dans Gladys.
- Le code PIN de sécurité de l’application, seulement pour déverrouiller la voiture depuis Gladys.

## Configuration

| Champ                     | Ce qu’il faut saisir                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| E-mail / Mot de passe     | Le compte Mercedes me                                                                    |
| Région                    | Europe (aussi Inde, Thaïlande), Amérique du Nord, Asie-Pacifique (aussi Amérique latine) |
| Code PIN de sécurité      | Facultatif : utile seulement pour déverrouiller                                          |
| Pause entre deux lectures | 1 minute par défaut ; plus long = moins de connexions à Mercedes                         |
| Rayon du domicile         | 200 m par défaut, pour la distance du domicile et les scènes arrivée/départ              |
| Langue des textes         | Automatique : la langue de votre tableau de bord                                         |
| Version de l’appli / SDK  | Avancé, laissez vide sauf si Mercedes refuse l’appli (erreur 418)                        |

Cliquez sur **Enregistrer**, puis sur **Tester la connexion** : elle liste vos voitures et le nombre de commandes que chacune accepte. Les maisons de Gladys doivent avoir une position sur la carte pour la distance du domicile.

## Utilisation

### Appareils

Ouvrez **Découvrir**, puis ajoutez vos voitures. Une fonctionnalité apparaît dès que la voiture a remonté sa valeur : s’il en manque une (carburant, toit ouvrant…), relancez la découverte plus tard. Verrouillage, préclimatisation et limite de charge se modifient depuis le tableau de bord quand la voiture accepte ces commandes. Une commande prend de quelques secondes à une minute : la voiture se réveille, l’exécute, puis Mercedes envoie le nouvel état.

### Widget de tableau de bord

![Le widget Voiture Mercedes-Benz pour deux voitures (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-mercedes-benz/main/docs/assets/widgets.fr.png)

Le widget **Voiture Mercedes-Benz** affiche la batterie ou le carburant, l’autonomie, le kilométrage, une liste d’états (verrouillage, ouvrants, charge, climatisation, moteur, position, alarme, alertes) et des boutons : verrouiller ou déverrouiller (le déverrouillage demande confirmation et le code PIN), préclimatiser, faire clignoter les feux, et la position sur une carte. Choisissez la voiture dans ses réglages, ou laissez vide pour la première voiture.

### Scènes

Déclencheurs : verrouillée ou déverrouillée, verrouillée mais ouverte, alarme antivol, moteur démarré ou arrêté, état de charge modifié, câble branché ou débranché, arrivée ou départ, nouvelle alerte, problème de compte. Actions : envoyer une commande (et attendre la réponse de la voiture), lire l’état d’une voiture (avec une phrase prête pour un message).

Exemples :

- Quand la voiture est verrouillée mais ouverte → m’envoyer un message avec le résumé.
- Quand la charge passe à « Chargée » → prévenir et couper la prise de recharge.
- Chaque jour ouvré à 7 h 30 en hiver → envoyer la commande « Lancer la préclimatisation ».

### Transport

Le badge d’une voiture indique **cloud**. Il passe à **injoignable** quand Mercedes refuse le compte, et affiche un point orange tant que Mercedes bloque la connexion en direct : les valeurs arrivent alors toutes les 10 minutes.

## Dépannage

- **E-mail ou mot de passe refusé** : vérifiez-les d’abord dans l’application officielle. Le compte ne doit pas demander de code (double authentification).
- **Compte bloqué (429)** : Mercedes limite la durée de connexion d’un compte chaque jour ; le blocage se lève souvent à minuit GMT. Utilisez un second compte dédié à Gladys, et une pause plus longue entre deux lectures.
- **Version d’application refusée (418)** : Mercedes exige une application plus récente. Mettez à jour l’intégration ; en attendant, saisissez les versions actuelles de l’appli et du SDK dans les réglages avancés (voir le projet mbapi2020).
- **Une valeur ou une commande manque** : toutes les voitures ne remontent pas tout, et certaines commandes dépendent des services de votre voiture. Cliquez sur **Diagnostic**, puis copiez les lignes de l’onglet Journaux dans une issue GitHub : elles contiennent ce que remonte la voiture, sans VIN, plaque ni position.
- **Déverrouillage refusé** : saisissez le code PIN de sécurité défini dans l’application Mercedes me.
