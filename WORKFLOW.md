# 🌿 Workflow de Développement - Reborn

## 📋 **Stratégie de Branching**

### 🔄 **Branches principales :**
- **`main`** : Branche de production, contient uniquement les versions stables
- **`dev`** : Branche de développement, intégration continue des nouvelles fonctionnalités

### 🎯 **Principe :**
- ✅ Développement quotidien sur `dev`
- ✅ Merge vers `main` uniquement pour les releases
- ✅ Création automatique de tags/releases lors des merges vers `main`
- ✅ Branche `dev` conservée après chaque merge

## 🚀 **Workflow de Développement**

### 1. **Développement quotidien**
```bash
# Travailler sur la branche dev
git checkout dev
git pull origin dev

# Développer vos fonctionnalités
# ... code, test, commit ...

git add .
git commit -m "Add new feature"
git push origin dev
```

### 2. **Prêt pour une release**
```bash
# Utiliser le script de release
npm run release

# Ou manuellement
npm run merge-to-main
```

## 🔧 **Scripts Disponibles**

### 📦 **Release principale**
```bash
npm run release
```
**Fait automatiquement :**
- ✅ Commit les changements non commitées sur `dev`
- ✅ Incrémente la version (patch/minor/major)
- ✅ Merge `dev` vers `main`
- ✅ Pousse les changements
- ✅ Déclenche GitHub Actions pour la release
- ✅ Retourne sur `dev` pour continuer le développement

### 🔄 **Merge vers main**
```bash
npm run merge-to-main
```
Identique à `npm run release` - script interactif complet.

### ⚡ **Releases rapides (dev uniquement)**
```bash
npm run release:patch    # Pour les corrections de bugs
npm run release:minor    # Pour les nouvelles fonctionnalités  
npm run release:major    # Pour les changements majeurs
```

## 🎯 **Processus de Release Automatique**

### 🔀 **Lors d'un merge vers `main` :**
1. **GitHub Actions se déclenche** automatiquement
2. **Build multi-plateforme** (Windows + Linux)
3. **Version extraite** du `package.json`
4. **Tag créé** automatiquement (`v1.2.3`)
5. **Release GitHub** créée avec les fichiers
6. **Auto-updater** peut détecter la nouvelle version

### 📊 **Avantages de cette stratégie :**
- ✅ **Moins de tags** - uniquement pour les vraies releases
- ✅ **Historique propre** - `main` contient uniquement les versions stables
- ✅ **Développement continu** - `dev` toujours disponible
- ✅ **Releases automatiques** - plus de gestion manuelle des tags
- ✅ **Traçabilité** - chaque release correspond à un merge

## 🔍 **Vérification**

### 📋 **Après une release :**
1. **GitHub Actions** : https://github.com/Xyspi/reborn/actions
2. **Releases** : https://github.com/Xyspi/reborn/releases
3. **Auto-updater** : Teste la détection de mise à jour

### 🚨 **En cas de problème :**
- Revenir sur `dev` : `git checkout dev`
- Annuler un merge : `git reset --hard HEAD~1` (sur main)
- Supprimer un tag : `git tag -d v1.2.3 && git push origin :refs/tags/v1.2.3`

## 💡 **Bonnes Pratiques**

### ✅ **À faire :**
- Toujours développer sur `dev`
- Tester avant de merger vers `main`
- Utiliser des messages de commit descriptifs
- Incrémenter la version appropriée (patch/minor/major)

### ❌ **À éviter :**
- Pousser directement sur `main`
- Créer des tags manuellement
- Oublier de merger `dev` vers `main` avant une release
- Supprimer la branche `dev`

## 🎭 **Exemple de Workflow Complet**

```bash
# 1. Développement
git checkout dev
git pull origin dev

# 2. Développer une nouvelle fonctionnalité
# ... code, test, commit ...

# 3. Prêt pour release
npm run release

# 4. Sélectionner le type de version
# > 1. Patch (1.2.2 → 1.2.3) - Bug fixes
# > 2. Minor (1.2.2 → 1.3.0) - New features  
# > 3. Major (1.2.2 → 2.0.0) - Breaking changes

# 5. Le script fait automatiquement :
# - Merge dev → main
# - Push vers GitHub
# - Déclenche la release
# - Retourne sur dev

# 6. Continuer le développement
# Vous êtes déjà sur dev, prêt pour la suite !
```

Cette stratégie vous permet d'avoir un historique propre et des releases contrôlées ! 🎯