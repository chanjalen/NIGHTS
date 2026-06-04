"""Small shared helpers used across apps."""
import uuid


def parse_uuid(value):
    """Return a ``uuid.UUID`` for ``value``, or ``None`` if it isn't valid.

    Lets views treat a malformed ``?venue=`` style parameter as "no match"
    instead of letting the DB driver raise and surface a 500.
    """
    if value is None:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None
