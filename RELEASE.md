# 🚀 Release Management

Cette documentation explique comment créer des releases automatiques pour Reborn.

## 📋 Scripts Disponibles

### 1. **Release Rapide (Patch)** - `npm run release:patch`
- Incrémente automatiquement la version patch (ex: 1.2.0 → 1.2.1)
- Commit les changements automatiquement
- Crée et pousse le tag
- Déclenche la release GitHub

```bash
npm run release:patch
```

### 2. **Release Interactive** - `npm run release`
- Interface interactive pour choisir le type de release
- Options: patch, minor, major, ou version custom
- Validation avant chaque étape

```bash
npm run release
```

### 3. **Release Minor** - `npm run release:minor`
- Incrémente la version minor (ex: 1.2.0 → 1.3.0)
- Útil pour les nouvelles fonctionnalités

```bash
npm run release:minor
```

### 4. **Release Major** - `npm run release:major`
- Incrémente la version major (ex: 1.2.0 → 2.0.0)
- Útil pour les breaking changes

```bash
npm run release:major
```

## 🔄 Processus Automatique

Chaque script effectue automatiquement :

1. **Vérification Git** - Vérifie s'il y a des changements non commitées
2. **Mise à jour version** - Met à jour `package.json`
3. **Commit** - Commit le bump de version
4. **Push** - Pousse vers `main`
5. **Tag** - Crée et pousse le tag `v{version}`
6. **GitHub Actions** - Déclenche automatiquement le build et la release

## 📦 Résultat

Une fois le script terminé :
- ✅ Release créée sur GitHub
- ✅ Fichiers `.exe` et `.AppImage` attachés
- ✅ Auto-updater peut détecter la nouvelle version
- ✅ Utilisateurs peuvent se mettre à jour

## 🎯 Recommandations

- **Patch** : Corrections de bugs, améliorations mineures
- **Minor** : Nouvelles fonctionnalités, améliorations importantes
- **Major** : Changements incompatibles, refactorisation majeure

## 🔗 Liens Utiles

- [GitHub Actions](https://github.com/Xyspi/reborn/actions)
- [Releases](https://github.com/Xyspi/reborn/releases)
- [Semantic Versioning](https://semver.org/)

## 🚨 Notes Importantes

- Les scripts vérifient automatiquement les changements non commitées
- Chaque release déclenche un build complet sur GitHub Actions
- Les releases sont automatiquement marquées comme "latest" pour l'auto-updater
- Les fichiers de release sont automatiquement nommés selon la plateforme

## 🛠️ Dépannage

Si une release échoue :
1. Vérifiez les logs GitHub Actions
2. Assurez-vous que le tag n'existe pas déjà
3. Vérifiez que vous avez les permissions sur le repository
4. Relancez le script avec une version différente

## 📞 Support

Pour toute question concernant les releases, créez une issue sur GitHub.