# README

{% for extension, details in biscuitcutter.file_types|dictsort %}
<dl>
  <dt>Format name:</dt>
  <dd>{{ details.name }}</dd>

  <dt>Extension:</dt>
  <dd>{{ extension }}</dd>

  <dt>Applications:</dt>
  <dd>
      <ul>
      {% for app in details.apps -%}
          <li>{{ app }}</li>
      {% endfor -%}
      </ul>
  </dd>
</dl>
{% endfor %}
