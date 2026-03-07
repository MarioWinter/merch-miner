from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class CustomUserManager(BaseUserManager):
    """Custom manager for User model using email as unique identifier."""
    
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The e-mail address must be set.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('A superuser must be a staff')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('A superuser must have is_superuser')
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    """Custom user model with email as username field."""
    
    username = models.CharField(
        'username',
        max_length=150,
        unique=True,
        blank=True,
        null=True
    )

    email = models.EmailField('E-Mail', unique=True)
    is_active = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []     

    avatar = models.URLField(blank=True, default='')

    objects = CustomUserManager()

    def __str__(self):
        return self.email


class BillingProfile(models.Model):
    class AccountType(models.TextChoices):
        PERSONAL = 'personal', 'Personal'
        BUSINESS = 'business', 'Business'

    user = models.OneToOneField(
        'User',
        on_delete=models.CASCADE,
        related_name='billing_profile',
    )
    account_type = models.CharField(
        max_length=10,
        choices=AccountType.choices,
        default=AccountType.PERSONAL,
    )
    company_name = models.CharField(max_length=200, blank=True, default='')
    vat_number = models.CharField(max_length=50, blank=True, default='')
    address_line1 = models.CharField(max_length=255, blank=True, default='')
    address_line2 = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')
    state_region = models.CharField(max_length=100, blank=True, default='')
    postal_code = models.CharField(max_length=20, blank=True, default='')
    country = models.CharField(max_length=2, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'BillingProfile({self.user})'
