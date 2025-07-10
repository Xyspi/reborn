# 📧 Configuration des Notifications Email

## 🔧 Configuration GitHub Secrets

Pour recevoir les notifications de build par email, configurez ces secrets dans votre repo GitHub :

### Aller dans : Settings > Secrets and variables > Actions

Ajouter ces secrets :

| Secret | Description | Exemple |
|--------|-------------|---------|
| `EMAIL_USERNAME` | Votre email Gmail | `votre.email@gmail.com` |
| `EMAIL_PASSWORD` | Mot de passe d'application Gmail | `xxxx xxxx xxxx xxxx` |
| `EMAIL_TO` | Email destinataire | `votre.email@gmail.com` |

## 🔑 Configuration Gmail

### 1. Activer l'authentification à 2 facteurs
- Aller dans votre compte Google
- Sécurité > Validation en deux étapes

### 2. Générer un mot de passe d'application
- Compte Google > Sécurité > Mots de passe des applications
- Sélectionner "Courrier" et votre appareil
- Copier le mot de passe généré (16 caractères)

### 3. Utiliser le mot de passe d'application
- Utiliser ce mot de passe pour `EMAIL_PASSWORD`
- **NE PAS** utiliser votre mot de passe Gmail normal

## 📧 Types de notifications

### ✅ Build Success
- Couleur verte
- Détails du build
- Liens de téléchargement
- Lien vers les détails

### ❌ Build Failed
- Couleur rouge
- Détails de l'erreur
- Étapes de résolution
- Lien vers les logs

## 🧪 Test

Pour tester les notifications :

```bash
# Créer un tag pour déclencher un build
git tag v1.0.5
git push origin v1.0.5

# Ou faire un simple push
git commit --allow-empty -m "Test notification"
git push origin main
```

## 📱 Alternatives

Si Gmail ne fonctionne pas, vous pouvez utiliser :

- **Outlook/Hotmail** : `smtp-mail.outlook.com:587`
- **Yahoo** : `smtp.mail.yahoo.com:587` 
- **SMTP personnalisé** : Modifier `server_address` et `server_port`

## 🔒 Sécurité

- ✅ Utiliser des mots de passe d'application
- ✅ Secrets stockés de manière sécurisée dans GitHub
- ✅ Pas de mots de passe en dur dans le code
- ❌ Ne jamais partager vos secrets